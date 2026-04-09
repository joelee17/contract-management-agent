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
  // GET /documents - list all indexed files with their tags and folder
  fastify.get('/documents', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await query(
      `SELECT f.file_id, f.file_name, f.mime_type, f.modified_time, f.chunk_count, f.indexed_at,
         f.folder_id,
         fol.name AS folder_name,
         COALESCE(
           json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FILTER (WHERE t.id IS NOT NULL), '[]'
         ) AS tags
       FROM indexed_files f
       LEFT JOIN folders fol ON f.folder_id = fol.id
       LEFT JOIN document_tags dt ON f.file_id = dt.file_id
       LEFT JOIN tags t ON dt.tag_id = t.id
       GROUP BY f.file_id, f.file_name, f.mime_type, f.modified_time, f.chunk_count, f.indexed_at, f.folder_id, fol.name
       ORDER BY fol.name NULLS LAST, f.file_name`
    );
    return reply.send({ documents: result.rows });
  });

  // DELETE /documents/:fileId - remove a document from the index
  fastify.delete('/documents/:fileId', { preHandler: [authenticate] }, async (request, reply) => {
    const { fileId } = request.params;
    const result = await query('SELECT file_id FROM indexed_files WHERE file_id = $1', [fileId]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Document not found' });
    }
    await query('DELETE FROM document_chunks WHERE file_id = $1', [fileId]);
    await query('DELETE FROM indexed_files WHERE file_id = $1', [fileId]);
    return reply.send({ ok: true });
  });

  // GET /folders - list all folders
  fastify.get('/folders', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await query('SELECT * FROM folders ORDER BY name');
    return reply.send({ folders: result.rows });
  });

  // POST /folders - create a folder
  fastify.post('/folders', { preHandler: [authenticate] }, async (request, reply) => {
    const { name } = request.body || {};
    if (!name?.trim()) return reply.status(400).send({ error: 'Name is required' });
    const result = await query(
      'INSERT INTO folders (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
      [name.trim()]
    );
    if (result.rows.length === 0) {
      return reply.status(409).send({ error: 'A folder with that name already exists' });
    }
    return reply.status(201).send({ folder: result.rows[0] });
  });

  // DELETE /folders/:id - delete a folder (documents become unfoldered)
  fastify.delete('/folders/:id', { preHandler: [authenticate] }, async (request, reply) => {
    await query('DELETE FROM folders WHERE id = $1', [request.params.id]);
    return reply.send({ ok: true });
  });

  // PATCH /documents/:fileId/folder - assign or remove a document's folder
  fastify.patch('/documents/:fileId/folder', { preHandler: [authenticate] }, async (request, reply) => {
    const { fileId } = request.params;
    const { folderId } = request.body || {}; // null to unassign
    await query('UPDATE indexed_files SET folder_id = $1 WHERE file_id = $2', [folderId || null, fileId]);
    return reply.send({ ok: true });
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
