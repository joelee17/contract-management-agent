import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import config from './config.js';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import queryRoutes from './routes/query.js';
import documentsRoutes from './routes/documents.js';
import syncRoutes from './routes/sync.js';
import webhooksRoutes from './routes/webhooks.js';
import tagsRoutes from './routes/tags.js';
import { startWatchChannel } from './services/driveService.js';

const fastify = Fastify({ logger: true });

// Plugins
await fastify.register(cors, {
  origin: [config.frontendUrl, 'http://localhost:5173'],
  credentials: true,
});

await fastify.register(jwt, {
  secret: config.jwtSecret,
});

// Auth decorator
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Health check
fastify.get('/api/health', async () => ({ status: 'ok' }));

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(queryRoutes, { prefix: '/api' });
await fastify.register(documentsRoutes, { prefix: '/api' });
await fastify.register(syncRoutes, { prefix: '/api' });
await fastify.register(tagsRoutes, { prefix: '/api' });
await fastify.register(webhooksRoutes, { prefix: '/api/webhooks' });

// Start
try {
  await initDb();
  await fastify.listen({ port: config.port, host: config.host });

  // Start Google Drive watch channel (non-blocking)
  if (config.googleServiceAccountKey && config.webhookBaseUrl) {
    startWatchChannel().catch((err) =>
      console.error('Failed to start Drive watch channel:', err.message)
    );
  }
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
