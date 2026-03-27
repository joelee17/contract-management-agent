import { query as dbQuery } from '../db.js';
import { embedQuery } from './embeddingService.js';

/**
 * Embed the user query, run cosine-similarity search against document_chunks,
 * and assemble a system prompt + user message with numbered source excerpts.
 *
 * Returns { systemPrompt, userMessage, sources }.
 */
export async function retrieveAndBuildPrompt(query, topK = 8) {
  // 1. Embed the query
  const queryVector = await embedQuery(query);
  const vectorLiteral = `[${queryVector.join(',')}]`;

  // 2. Cosine similarity search using pgvector
  const result = await dbQuery(
    `SELECT
       id,
       file_id,
       file_name,
       page_number,
       section_heading,
       chunk_text,
       char_offset_start,
       char_offset_end,
       1 - (embedding <=> $1::vector) AS similarity
     FROM document_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorLiteral, topK],
  );

  const sources = result.rows.map((row, idx) => ({
    sourceIndex: idx + 1,
    fileId: row.file_id,
    fileName: row.file_name,
    pageNumber: row.page_number,
    sectionHeading: row.section_heading,
    chunkText: row.chunk_text,
    charOffsetStart: row.char_offset_start,
    charOffsetEnd: row.char_offset_end,
    similarity: parseFloat(row.similarity),
  }));

  // 3. Build the system prompt
  const systemPrompt = [
    'You are a contract-analysis assistant. Answer the user\'s question based ONLY on the provided document excerpts.',
    'If the excerpts do not contain enough information to answer, say so clearly.',
    'Cite your sources using [Source N] notation (e.g. [Source 1], [Source 3]) where N refers to the numbered excerpts.',
    'Be precise and refer to specific clauses, sections, or language from the contracts when relevant.',
  ].join('\n');

  // 4. Build the user message with numbered sources
  const excerptBlocks = sources.map((s) => {
    const heading = s.sectionHeading ? ` | ${s.sectionHeading}` : '';
    const page = s.pageNumber ? ` | Page ${s.pageNumber}` : '';
    return `[Source ${s.sourceIndex}] (${s.fileName}${page}${heading})\n${s.chunkText}`;
  });

  const userMessage = [
    '--- Document Excerpts ---',
    ...excerptBlocks,
    '--- End of Excerpts ---',
    '',
    `Question: ${query}`,
  ].join('\n\n');

  return { systemPrompt, userMessage, sources };
}
