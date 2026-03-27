import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';

import { query as dbQuery } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { retrieveAndBuildPrompt } from '../services/retrievalService.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export default async function queryRoutes(fastify) {
  fastify.post('/query', { preHandler: [authenticate] }, async (request, reply) => {
    const { question, conversationId, tagIds } = request.body || {};
    const userId = request.user.id;

    if (!question) {
      return reply.status(400).send({ error: 'Question is required' });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const convResult = await dbQuery(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
        [userId, question.substring(0, 100)]
      );
      convId = convResult.rows[0].id;
    }

    // Save user message
    await dbQuery(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'user', question]
    );

    // Retrieve relevant context and build prompt with sources (optionally scoped by tags)
    const activeTagIds = Array.isArray(tagIds) && tagIds.length > 0 ? tagIds.map(Number) : null;
    const { systemPrompt, userMessage, sources } = await retrieveAndBuildPrompt(question, 8, activeTagIds);

    // Set SSE headers (must include CORS manually since we bypass Fastify's response pipeline)
    const origin = request.headers.origin;
    const allowedOrigins = [config.frontendUrl, 'http://localhost:5173'];
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...(allowedOrigins.includes(origin) && {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      }),
    });

    // Send sources as the first SSE event
    reply.raw.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);

    // Stream response from Claude
    let fullResponse = '';

    try {
      const stream = anthropic.messages.stream({
        model: config.anthropicModel,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const text = event.delta.text;
          fullResponse += text;
          reply.raw.write(`event: text\ndata: ${JSON.stringify(text)}\n\n`);
        }
      }
    } catch (err) {
      fastify.log.error(err, 'Anthropic streaming error');
      reply.raw.write(`event: error\ndata: ${JSON.stringify('Failed to generate response')}\n\n`);
    }

    // Send done event
    reply.raw.write(`event: done\ndata: ${JSON.stringify({ conversationId: convId })}\n\n`);
    reply.raw.end();

    // Save assistant message (non-blocking)
    dbQuery(
      'INSERT INTO messages (conversation_id, role, content, sources) VALUES ($1, $2, $3, $4)',
      [convId, 'assistant', fullResponse, JSON.stringify(sources)]
    ).catch((err) => fastify.log.error(err, 'Failed to save assistant message'));

    // Update conversation timestamp
    dbQuery('UPDATE conversations SET updated_at = now() WHERE id = $1', [convId]).catch(() => {});
  });
}
