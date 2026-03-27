import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

export default function SourcesFooter({ sources, onOpenDocument }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <span>Sources ({sources.length})</span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {sources.map((source, index) => {
            const fileName = source.fileName || source.name || 'Unknown';
            const page = source.page || source.pageNumber;
            const section = source.section || source.heading;

            return (
              <button
                key={index}
                onClick={() =>
                  onOpenDocument(
                    source.fileId,
                    page,
                    source.charOffsetStart,
                    source.charOffsetEnd,
                    fileName
                  )
                }
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] text-xs font-semibold mt-0.5">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {fileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {page && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Page {page}
                      </span>
                    )}
                    {section && (
                      <>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          &middot;
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] truncate">
                          {section}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
