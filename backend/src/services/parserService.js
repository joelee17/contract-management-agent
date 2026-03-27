import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Route a document buffer to the correct parser based on MIME type.
 * Returns { pages: [{ pageNumber, text }] }.
 */
export async function parseDocument(buffer, mimeType, fileName) {
  const normalised = mimeType?.toLowerCase() || '';

  if (normalised === 'application/pdf') {
    return parsePdf(buffer);
  }

  if (
    normalised === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalised === 'application/vnd.google-apps.document'
  ) {
    return parseDocx(buffer);
  }

  if (normalised.startsWith('text/')) {
    return {
      pages: [{ pageNumber: 1, text: buffer.toString('utf-8') }],
    };
  }

  // TODO: Add Google Document AI OCR support for scanned documents / images
  throw new Error(`Unsupported MIME type for parsing: ${mimeType} (${fileName})`);
}

/**
 * Parse a PDF buffer. Returns pages with per-page text where possible.
 */
export async function parsePdf(buffer) {
  // pdf-parse provides per-page text via the pagerender callback
  const pages = [];

  const result = await pdfParse(buffer, {
    // Custom page renderer that collects text per page
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const strings = textContent.items.map((item) => item.str);
      return strings.join(' ');
    },
  });

  // pdf-parse stores per-page text in result.text separated by page breaks,
  // but using the pagerender callback we get them in order.
  // Split by the page-break markers that pdf-parse inserts.
  const rawPages = result.text.split(/\f/);

  for (let i = 0; i < rawPages.length; i++) {
    const text = rawPages[i].trim();
    if (text) {
      pages.push({ pageNumber: i + 1, text });
    }
  }

  // Fallback: if splitting didn't work, treat as single page
  if (pages.length === 0 && result.text.trim()) {
    pages.push({ pageNumber: 1, text: result.text.trim() });
  }

  return { pages };
}

/**
 * Parse a DOCX buffer. Returns the entire document as a single page.
 */
export async function parseDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return {
    pages: [{ pageNumber: 1, text: result.value }],
  };
}
