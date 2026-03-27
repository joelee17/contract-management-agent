const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/**
 * Regex to detect common contract section headings.
 * Matches patterns like:
 *   "Section 1.2", "SECTION 12.3.4", "ARTICLE IV", "Article 3",
 *   "Clause 7", "CLAUSE 3.1", "Exhibit A", "Schedule 1"
 */
const HEADING_PATTERN =
  /^(?:(?:SECTION|Section|ARTICLE|Article|CLAUSE|Clause|EXHIBIT|Exhibit|SCHEDULE|Schedule|APPENDIX|Appendix|RECITAL|Recital)\s+[\dA-Z]+(?:[.\-][\dA-Z]+)*)[.:\s\-]/m;

/**
 * Takes parsed pages and splits them into overlapping chunks with metadata.
 *
 * @param {Array<{pageNumber: number, text: string}>} pages
 * @param {string} fileName
 * @returns {Array<{text: string, pageNumber: number, chunkIndex: number, sectionHeading: string|null, charOffsetStart: number, charOffsetEnd: number}>}
 */
export function chunkDocument(pages, fileName) {
  const chunks = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    const pageText = page.text;
    if (!pageText || pageText.trim().length === 0) continue;

    const pageChunks = recursiveSplit(pageText, CHUNK_SIZE, CHUNK_OVERLAP);

    for (const pc of pageChunks) {
      chunks.push({
        text: pc.text,
        pageNumber: page.pageNumber,
        chunkIndex: globalChunkIndex++,
        sectionHeading: detectSectionHeading(pc.text),
        charOffsetStart: pc.start,
        charOffsetEnd: pc.end,
      });
    }
  }

  return chunks;
}

/**
 * Recursively split text into chunks of approximately `maxSize` characters
 * with `overlap` characters of overlap between consecutive chunks.
 *
 * Tries to split on paragraph breaks first, then sentence boundaries,
 * then word boundaries, falling back to hard character splits.
 */
function recursiveSplit(text, maxSize, overlap) {
  if (text.length <= maxSize) {
    return [{ text, start: 0, end: text.length }];
  }

  const separators = ['\n\n', '\n', '. ', ' '];
  const results = [];
  let currentStart = 0;

  while (currentStart < text.length) {
    let end = currentStart + maxSize;

    if (end >= text.length) {
      results.push({
        text: text.slice(currentStart).trim(),
        start: currentStart,
        end: text.length,
      });
      break;
    }

    // Try to find the best split point using separators
    let splitAt = -1;
    for (const sep of separators) {
      const searchSlice = text.slice(currentStart, end);
      const lastIdx = searchSlice.lastIndexOf(sep);
      if (lastIdx > maxSize * 0.3) {
        // Only use this split if it's past 30% of the chunk
        splitAt = currentStart + lastIdx + sep.length;
        break;
      }
    }

    // Hard split if no good separator found
    if (splitAt <= currentStart) {
      splitAt = end;
    }

    results.push({
      text: text.slice(currentStart, splitAt).trim(),
      start: currentStart,
      end: splitAt,
    });

    // Move forward with overlap
    currentStart = splitAt - overlap;
    if (currentStart <= results[results.length - 1].start) {
      // Safety: always move forward
      currentStart = splitAt;
    }
  }

  return results.filter((r) => r.text.length > 0);
}

/**
 * Detect the most prominent section heading in a chunk of text.
 * Returns the matched heading string or null.
 */
function detectSectionHeading(text) {
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(HEADING_PATTERN);
    if (match) {
      // Return the full line as the heading (trimmed, capped at 200 chars)
      return trimmed.slice(0, 200);
    }
  }

  return null;
}
