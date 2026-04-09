import { useState } from 'react';

const CIRCLE_NUMBERS = [
  '\u2776', '\u2777', '\u2778', '\u2779', '\u277A',
  '\u277B', '\u277C', '\u277D', '\u277E', '\u277F',
];

export default function SourceCitation({ sourceIndex, source, onOpenDocument }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const label = CIRCLE_NUMBERS[sourceIndex - 1] || `[${sourceIndex}]`;
  const fileName = source?.fileName || source?.name || `Source ${sourceIndex}`;
  const page = source?.page || source?.pageNumber;
  const section = source?.section || source?.heading;

  function handleClick() {
    if (source && onOpenDocument) {
      onOpenDocument(
        source.fileId,
        source.page || source.pageNumber,
        source.charOffsetStart,
        source.charOffsetEnd,
        fileName,
        source.chunkText
      );
    }
  }

  return (
    <span className="relative inline-block">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-semibold rounded bg-[var(--color-citation-bg)] text-[var(--color-citation-text)] hover:bg-[var(--color-citation-hover)] transition-colors cursor-pointer align-super leading-none"
        aria-label={`Source ${sourceIndex}: ${fileName}`}
      >
        {label}
      </button>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-[var(--color-text-primary)] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-xs">
            <div className="font-medium truncate">{fileName}</div>
            {page && (
              <div className="text-slate-300 mt-0.5">Page {page}</div>
            )}
            {section && (
              <div className="text-slate-300 mt-0.5 truncate">{section}</div>
            )}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 bg-[var(--color-text-primary)] rotate-45 transform" />
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
