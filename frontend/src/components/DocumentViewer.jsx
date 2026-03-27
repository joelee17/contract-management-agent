import { useState, useEffect, useMemo } from 'react';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { highlightPlugin } from '@react-pdf-viewer/highlight';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
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

export default function DocumentViewer({
  fileId,
  page,
  highlights,
  fileName,
  onClose,
}) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);

  // Load PDF when fileId changes
  useEffect(() => {
    if (!fileId) return;

    let revoked = false;
    setLoading(true);
    setError('');

    getDocumentPdf(fileId)
      .then((blob) => {
        if (revoked) return;
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch((err) => {
        if (!revoked) setError(err.message);
      })
      .finally(() => {
        if (!revoked) setLoading(false);
      });

    return () => {
      revoked = true;
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [fileId]);

  // Jump to page when it changes
  useEffect(() => {
    if (page != null) {
      setCurrentPage(page);
    }
  }, [page]);

  // Highlight plugin configuration
  const highlightPluginInstance = highlightPlugin({
    renderHighlights: (props) => (
      <div>
        {highlights
          ?.filter((h) => h.pageIndex === props.pageIndex)
          .map((h, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(79, 70, 229, 0.15)',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
              }}
            />
          ))}
      </div>
    ),
  });

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

      {/* PDF content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-[var(--color-danger)] mx-auto mb-2" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {error}
              </p>
            </div>
          </div>
        ) : pdfUrl ? (
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <div style={{ height: '100%' }}>
              <Viewer
                fileUrl={pdfUrl}
                initialPage={currentPage}
                defaultScale={scale}
                plugins={[highlightPluginInstance]}
                onDocumentLoad={(e) => {
                  setTotalPages(e.doc.numPages);
                }}
                onPageChange={(e) => {
                  setCurrentPage(e.currentPage);
                }}
              />
            </div>
          </Worker>
        ) : null}
      </div>
    </div>
  );
}
