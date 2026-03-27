import { query as dbQuery, getClient } from '../db.js';
import { listFiles, downloadFile } from './driveService.js';
import { parseDocument } from './parserService.js';
import { chunkDocument } from './chunkerService.js';
import { embedTexts } from './embeddingService.js';

/** Max texts to embed in a single Voyage API call. */
const EMBED_BATCH_SIZE = 64;

/**
 * Full incremental sync: list Drive files, compare with indexed_files table,
 * process new or modified files.
 */
export async function syncFiles() {
  console.log('Starting file sync...');

  const driveFiles = await listFiles();
  console.log(`Found ${driveFiles.length} files in Drive folder`);

  // Get currently indexed files
  const indexed = await dbQuery('SELECT file_id, modified_time FROM indexed_files');
  const indexedMap = new Map(indexed.rows.map((r) => [r.file_id, r.modified_time]));

  let processed = 0;
  let skipped = 0;

  for (const file of driveFiles) {
    const existingModified = indexedMap.get(file.id);

    // Skip if already indexed and not modified
    if (
      existingModified &&
      new Date(file.modifiedTime).getTime() <= new Date(existingModified).getTime()
    ) {
      skipped++;
      continue;
    }

    try {
      await processFile(file);
      processed++;
    } catch (err) {
      console.error(`Failed to process file ${file.name} (${file.id}):`, err);
    }
  }

  console.log(`Sync complete: ${processed} processed, ${skipped} skipped`);
  return { processed, skipped, total: driveFiles.length };
}

/**
 * Download, parse, chunk, embed, and store a single file.
 * Deletes old chunks when re-indexing a modified file.
 */
export async function processFile(fileMetadata) {
  const { id: fileId, name: fileName, mimeType, modifiedTime } = fileMetadata;
  console.log(`Processing file: ${fileName} (${fileId})`);

  // 1. Download
  const buffer = await downloadFile(fileId);
  console.log(`  Downloaded ${buffer.length} bytes`);

  // 2. Parse
  const resolvedMimeType =
    mimeType === 'application/vnd.google-apps.document'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : mimeType;

  const parsed = await parseDocument(buffer, resolvedMimeType, fileName);
  console.log(`  Parsed ${parsed.pages.length} page(s)`);

  // 3. Chunk
  const chunks = chunkDocument(parsed.pages, fileName);
  console.log(`  Created ${chunks.length} chunks`);

  if (chunks.length === 0) {
    console.log('  No chunks produced, skipping');
    return;
  }

  // 4. Embed in batches
  const allEmbeddings = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedTexts(batch.map((c) => c.text));
    allEmbeddings.push(...embeddings);
  }
  console.log(`  Embedded ${allEmbeddings.length} chunks`);

  // 5. Store in database (transactional)
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Delete old chunks for this file
    await client.query('DELETE FROM document_chunks WHERE file_id = $1', [fileId]);

    // Insert new chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = allEmbeddings[i];
      const vectorLiteral = `[${embedding.join(',')}]`;

      await client.query(
        `INSERT INTO document_chunks
           (file_id, file_name, chunk_text, chunk_index, page_number,
            section_heading, char_offset_start, char_offset_end, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
        [
          fileId,
          fileName,
          chunk.text,
          chunk.chunkIndex,
          chunk.pageNumber,
          chunk.sectionHeading,
          chunk.charOffsetStart,
          chunk.charOffsetEnd,
          vectorLiteral,
        ],
      );
    }

    // Upsert indexed_files record
    await client.query(
      `INSERT INTO indexed_files (file_id, file_name, mime_type, modified_time, chunk_count, indexed_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (file_id) DO UPDATE SET
         file_name = EXCLUDED.file_name,
         mime_type = EXCLUDED.mime_type,
         modified_time = EXCLUDED.modified_time,
         chunk_count = EXCLUDED.chunk_count,
         indexed_at = now()`,
      [fileId, fileName, mimeType, modifiedTime, chunks.length],
    );

    await client.query('COMMIT');
    console.log(`  Stored ${chunks.length} chunks for ${fileName}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
