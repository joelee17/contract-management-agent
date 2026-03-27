import { authenticate } from '../middleware/auth.js';
import { syncFiles } from '../services/syncService.js';

export default async function syncRoutes(fastify) {
  // POST /sync - trigger file sync from Google Drive
  fastify.post('/sync', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const result = await syncFiles();
      return reply.send({ status: 'ok', ...result });
    } catch (err) {
      fastify.log.error(err, 'Sync failed');
      return reply.status(500).send({ error: 'Sync failed', message: err.message });
    }
  });
}
