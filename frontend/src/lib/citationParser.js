/**
 * Parses [Source N] markers from response text into structured segments.
 * Returns an array of { type: 'text' | 'citation', content, sourceIndex? }
 */
export function parseCitations(text) {
  if (!text) return [];

  const segments = [];
  const regex = /\[Source\s+(\d+)\]/gi;
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

    // Add the citation
    segments.push({
      type: 'citation',
      content: match[0],
      sourceIndex: parseInt(match[1], 10),
    });

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
