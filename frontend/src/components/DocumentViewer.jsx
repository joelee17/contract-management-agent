import { useState, useEffect, useRef } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { searchPlugin } from '@react-pdf-viewer/search';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import { getDocumentPdf } from '../lib/api';
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';

function isPdf(fileName) {
  return fileName?.toLowerCase().endsWith('.pdf');
}

function isDocx(fileName) {
  return fileName?.toLowerCase().endsWith('.docx');
}

/** Render plain text with the chunk passage highlighted and scrolled into view */
function HighlightedText({ text, chunkText }) {
  const markRef = useRef(null);

  useEffect(() => {
    if (markRef.current) {
      markRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [chunkText]);

  if (!chunkText || !text) {
    return (
      <pre className="p-6 text-sm text-[var(--color-text-primary)] font-mono whitespace-pre-wrap leading-relaxed">
        {text}
      </pre>
    );
  }

  // Find first occurrence using first ~120 chars (case-insensitive)
  const needle = chunkText.slice(0, 120).toLowerCase();
  const idx = text.toLowerCase().indexOf(needle);
  if (idx === -1) {
    return (
      <pre className="p-6 text-sm text-[var(--color-text-primary)] font-mono whitespace-pre-wrap leading-relaxed">
        {text}
      </pre>
    );
  }

  const matchLen = Math.min(chunkText.length, text.length - idx);
  return (
    <pre className="p-6 text-sm text-[var(--color-text-primary)] font-mono whitespace-pre-wrap leading-relaxed">
      {text.slice(0, idx)}
      <mark
        ref={markRef}
        style={{ background: 'rgba(79, 70, 229, 0.25)', borderRadius: '2px', padding: '0 1px' }}
      >
        {text.slice(idx, idx + matchLen)}
      </mark>
      {text.slice(idx + matchLen)}
    </pre>
  );
}

/**
 * Inject a highlight script into DOCX HTML.
 * Uses TreeWalker to find the chunk text and wraps it in a <mark>.
 */
function injectHighlightScript(html, chunkText) {
  if (!chunkText) return html;

  const script = `<script>
window.addEventListener('DOMContentLoaded', function() {
  var needle = ${JSON.stringify(chunkText.slice(0, 200))}.replace(/\\s+/g, ' ').toLowerCase().trim();
  if (!needle) return;
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  var node;
  while ((node = walker.nextNode())) {
    var val = node.nodeValue.replace(/\\s+/g, ' ');
    var idx = val.toLowerCase().indexOf(needle.slice(0, 80));
    if (idx !== -1) {
      try {
        var range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, Math.min(idx + needle.length, node.nodeValue.length));
        var mark = document.createElement('mark');
        mark.style.cssText = 'background:rgba(79,70,229,0.25);border-radius:2px;padding:0 1px';
        range.surroundContents(mark);
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch(e) { /* node may span multiple elements */ }
      break;
    }
  }
});
<\/script>`;

  return html.includes('</body>') ? html.replace('</body>', script + '</body>') : html + script;
}

export default function DocumentViewer({
  fileId,
  page,
  highlights,
  fileName,
  onClose,
}) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [htmlUrl, setHtmlUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [pdfLoaded, setPdfLoaded] = useState(false);

  // Store raw DOCX html separately so we can rebuild the blob when chunkText changes
  const rawHtmlRef = useRef(null);

  const chunkText = highlights?.[0]?.chunkText || null;

  // Stable search plugin instance — created once on mount (lazy useState init)
  // so React hooks inside searchPlugin() are always called unconditionally
  const [searchPluginInstance] = useState(() => searchPlugin());
  const { highlight: pdfHighlight, clearHighlights: pdfClearHighlights } = searchPluginInstance;

  // Load document when fileId changes
  useEffect(() => {
    if (!fileId) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setPdfUrl(null);
    setHtmlUrl(null);
    setTextContent(null);
    setPdfLoaded(false);
    rawHtmlRef.current = null;

    getDocumentPdf(fileId)
      .then(async (blob) => {
        if (cancelled) return;
        if (isPdf(fileName)) {
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
        } else if (isDocx(fileName)) {
          const html = await blob.text();
          rawHtmlRef.current = html;
          const injected = injectHighlightScript(html, chunkText);
          const url = URL.createObjectURL(new Blob([injected], { type: 'text/html' }));
          setHtmlUrl(url);
        } else {
          const text = await blob.text();
          setTextContent(text);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      setHtmlUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [fileId, fileName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild DOCX blob URL when chunkText changes (same doc, different citation)
  useEffect(() => {
    if (!rawHtmlRef.current) return;
    const injected = injectHighlightScript(rawHtmlRef.current, chunkText);
    const url = URL.createObjectURL(new Blob([injected], { type: 'text/html' }));
    setHtmlUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
  }, [chunkText]);

  // Jump to page when it changes
  useEffect(() => {
    if (page != null) setCurrentPage(page);
  }, [page]);

  // Re-run PDF highlight when chunkText changes (or after document loads)
  useEffect(() => {
    if (!pdfLoaded) return;
    if (chunkText) {
      pdfHighlight([{ keyword: chunkText.slice(0, 120).trim(), matchCase: false }]);
    } else {
      pdfClearHighlights();
    }
  }, [chunkText, pdfLoaded]);

  if (!fileId) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--color-bg-secondary)]">
        <div className="text-center">
          <FileText className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--color-text-muted)]">
            Click a citation to view the source document
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-card)]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {fileName || 'Document'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded hover:bg-[var(--color-border)] transition-colors"
        >
          <X className="w-4 h-4 text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
          <span className="text-xs text-[var(--color-text-muted)] w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2, s + 0.1))}
            className="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {totalPages > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage <= 0}
              className="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />
            </button>
            <span className="text-xs text-[var(--color-text-muted)]">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 rounded hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
            </button>
          </div>
        )}
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-[var(--color-danger)] mx-auto mb-2" />
              <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
            </div>
          </div>
        ) : htmlUrl ? (
          <iframe
            key={htmlUrl}
            src={htmlUrl}
            className="w-full h-full border-0"
            title={fileName}
            sandbox="allow-same-origin allow-scripts"
          />
        ) : textContent != null ? (
          <HighlightedText text={textContent} chunkText={chunkText} />
        ) : pdfUrl ? (
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <div style={{ height: '100%' }}>
              <Viewer
                fileUrl={pdfUrl}
                initialPage={currentPage}
                defaultScale={scale}
                plugins={[searchPluginInstance]}
                onDocumentLoad={(e) => {
                  setTotalPages(e.doc.numPages);
                  setPdfLoaded(true);
                  if (chunkText) {
                    // Small delay to let the text layer render
                    setTimeout(() => {
                      pdfHighlight([{ keyword: chunkText.slice(0, 120).trim(), matchCase: false }]);
                    }, 400);
                  }
                }}
                onPageChange={(e) => setCurrentPage(e.currentPage)}
              />
            </div>
          </Worker>
        ) : null}
      </div>
    </div>
  );
}
