import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';
import { query as dbQuery } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { retrieveContext } from '../services/retrievalService.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const SYSTEM_PROMPT = `You are a contract management assistant. You help users understand and analyze their contracts and legal documents.
Use the provided context from the user's documents to answer questions accurately. If the context doesn't contain enough information to answer, say so clearly.
Always cite which document(s) your answer is based on when relevant.`;

export default async function queryRoutes(fastify) {
  fastify.post('/query', { preHandler: [authenticate] }, async (request, reply) => {
    const { question, conversationId } = request.body || {};
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

    // Retrieve relevant context and sources
    const { context, sources } = await retrieveContext(question);

    // Load conversation history
    const historyResult = await dbQuery(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [convId]
    );
    const history = historyResult.rows.slice(-10); // last 10 messages for context window

    // Build messages array
    const messages = history.map((m) => ({ role: m.role, content: m.content }));
    // Append context to the latest user message
    const lastIdx = messages.length - 1;
    if (context) {
      messages[lastIdx] = {
        role: 'user',
        content: `Context from documents:\n${context}\n\nQuestion: ${messages[lastIdx].content}`,
      };
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send sources as the first SSE event
    reply.raw.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);

    // Stream response from Claude
    let fullResponse = '';

    try {
      const stream = anthropic.messages.stream({
        model: config.anthropicModel,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages,
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
