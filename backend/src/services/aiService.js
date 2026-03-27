import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * Stream a response from Claude given a system prompt and user message.
 * Returns an async generator that yields text chunks.
 */
export async function* streamResponse(systemPrompt, userMessage) {
  const stream = await client.messages.stream({
    model: config.anthropicModel,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
