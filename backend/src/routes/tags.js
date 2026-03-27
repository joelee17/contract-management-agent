import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

export default async function tagsRoutes(fastify) {
  // GET /tags - list all tags
  fastify.get('/tags', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await query('SELECT id, name, color FROM tags ORDER BY name');
    return reply.send({ tags: result.rows });
  });

  // POST /tags - create a new tag
  fastify.post('/tags', { preHandler: [authenticate] }, async (request, reply) => {
    const { name, color = '#6366f1' } = request.body || {};
    if (!name?.trim()) {
      return reply.status(400).send({ error: 'Tag name is required' });
    }
    try {
      const result = await query(
        'INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING id, name, color',
        [name.trim(), color]
      );
      return reply.status(201).send({ tag: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'A tag with that name already exists' });
      }
      throw err;
    }
  });

  // POST /documents/:fileId/tags - assign a tag to a document
  fastify.post('/documents/:fileId/tags', { preHandler: [authenticate] }, async (request, reply) => {
    const { fileId } = request.params;
    const { tagId } = request.body || {};

    if (!tagId) {
      return reply.status(400).send({ error: 'tagId is required' });
    }

    const docResult = await query('SELECT file_id FROM indexed_files WHERE file_id = $1', [fileId]);
    if (docResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    await query(
      'INSERT INTO document_tags (file_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [fileId, tagId]
    );

    const tagsResult = await query(
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN document_tags dt ON t.id = dt.tag_id
       WHERE dt.file_id = $1
       ORDER BY t.name`,
      [fileId]
    );

    return reply.send({ tags: tagsResult.rows });
  });

  // DELETE /documents/:fileId/tags/:tagId - remove a tag from a document
  fastify.delete('/documents/:fileId/tags/:tagId', { preHandler: [authenticate] }, async (request, reply) => {
    const { fileId, tagId } = request.params;
    await query(
      'DELETE FROM document_tags WHERE file_id = $1 AND tag_id = $2',
      [fileId, parseInt(tagId, 10)]
    );
    return reply.send({ ok: true });
  });
}
