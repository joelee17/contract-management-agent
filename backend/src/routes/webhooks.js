import { syncFiles } from '../services/syncService.js';

export default async function webhooksRoutes(fastify) {
  // POST /drive - Google Drive push notification handler
  fastify.post('/drive', async (request, reply) => {
    const resourceState = request.headers['x-goog-resource-state'];

    fastify.log.info({ resourceState }, 'Drive webhook received');

    // Return 200 immediately - processing happens async
    reply.status(200).send({ received: true });

    if (resourceState === 'change') {
      syncFiles().catch((err) =>
        fastify.log.error(err, 'Drive webhook sync failed')
      );
    }
  });
}
