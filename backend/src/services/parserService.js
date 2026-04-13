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
 * Parse a PDF buffer. Returns pages with per-page text.
 * Uses the pagerender callback to collect text per page in order.
 */
export async function parsePdf(buffer) {
  const pageTexts = [];

  await pdfParse(buffer, {
    // pdf-parse calls this sequentially for each page; we collect in order
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ').trim();
      pageTexts.push(text);
      return text;
    },
  });

  const pages = pageTexts
    .map((text, i) => ({ pageNumber: i + 1, text }))
    .filter((p) => p.text.length > 0);

  // Fallback: if the callback approach yielded nothing, parse without renderer
  if (pages.length === 0) {
    const result = await pdfParse(buffer);
    if (result.text.trim()) {
      return { pages: [{ pageNumber: 1, text: result.text.trim() }] };
    }
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
