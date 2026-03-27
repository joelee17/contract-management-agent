import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { downloadFile } from '../services/driveService.js';

export default async function documentsRoutes(fastify) {
  // GET /documents - list all indexed files
  fastify.get('/documents', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await query(
      'SELECT file_id, file_name, mime_type, modified_time, chunk_count, indexed_at FROM indexed_files ORDER BY indexed_at DESC'
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

      reply.header('Content-Type', mime_type || 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="${file_name}"`);

      return reply.send(fileStream);
    } catch (err) {
      fastify.log.error(err, 'Failed to download file from Google Drive');
      return reply.status(502).send({ error: 'Failed to retrieve document' });
    }
  });
}
