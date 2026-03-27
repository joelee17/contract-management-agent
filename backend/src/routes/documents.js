import mammoth from 'mammoth';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { downloadFile } from '../services/driveService.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function documentsRoutes(fastify) {
  // GET /documents - list all indexed files with their tags
  fastify.get('/documents', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await query(
      `SELECT f.file_id, f.file_name, f.mime_type, f.modified_time, f.chunk_count, f.indexed_at,
         COALESCE(
           json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FILTER (WHERE t.id IS NOT NULL), '[]'
         ) AS tags
       FROM indexed_files f
       LEFT JOIN document_tags dt ON f.file_id = dt.file_id
       LEFT JOIN tags t ON dt.tag_id = t.id
       GROUP BY f.file_id, f.file_name, f.mime_type, f.modified_time, f.chunk_count, f.indexed_at
       ORDER BY f.indexed_at DESC`
    );
    return reply.send({ documents: result.rows });
  });

  // GET /documents/:fileId/pdf - proxy file from Google Drive
  fastify.get('/documents/:fileId/pdf', { preHandler: [authenticate] }, async (request, reply) => {
    const { fileId } = request.params;

    // Verify file exists in our index
    const result = await query('SELECT file_name, mime_type FROM indexed_files WHERE file_id = $1', [fileId]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const { file_name, mime_type } = result.rows[0];

    try {
      const fileStream = await downloadFile(fileId);

      // Convert DOCX to HTML for browser rendering
      if (mime_type === DOCX_MIME) {
        const buffer = await streamToBuffer(fileStream);
        const { value: html } = await mammoth.convertToHtml({ buffer });
        reply.header('Content-Type', 'text/html; charset=utf-8');
        return reply.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;max-width:800px">${html}</body></html>`);
      }

      reply.header('Content-Type', mime_type || 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="${file_name}"`);

      return reply.send(fileStream);
    } catch (err) {
      fastify.log.error(err, 'Failed to download file from Google Drive');
      return reply.status(502).send({ error: 'Failed to retrieve document' });
    }
  });
}
