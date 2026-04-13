/**
 * Parses [Source N] markers from response text into structured segments.
 * Returns an array of { type: 'text' | 'citation', content, sourceIndex? }
 *
 * Handles variants:
 *   [Source N]   **[Source N]**   (Source N)
 *   [Source N, M]  [Source N and M]  — expanded into multiple citations
 */
export function parseCitations(text) {
  if (!text) return [];

  const segments = [];
  // Matches: optional bold markers, optional bracket/paren, "Source", one or more
  // comma/and-separated numbers, closing bracket/paren, optional bold markers
  const regex = /\*{0,2}[\[(]Sources?\s+([\d]+(?:\s*[,&]\s*[\d]+|\s+and\s+[\d]+)*)\s*[\])]\*{0,2}/gi;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this citation
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Extract all numbers from the match (handles "1, 2" or "1 and 2")
    const numbers = match[1].match(/\d+/g) || [];
    for (const num of numbers) {
      segments.push({
        type: 'citation',
        content: match[0],
        sourceIndex: parseInt(num, 10),
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
