import { VoyageAIClient } from 'voyageai';
import config from '../config.js';

const client = new VoyageAIClient({ apiKey: config.voyageApiKey });

/**
 * Embed an array of texts in a single batch request.
 * Returns an array of embedding vectors (number[][]).
 */
export async function embedTexts(texts) {
  if (texts.length === 0) return [];

  const result = await client.embed({
    input: texts,
    model: config.voyageModel,
    inputType: 'document',
  });

  return result.data.map((d) => d.embedding);
}

/**
 * Embed a single query string.
 * Returns one embedding vector (number[]).
 */
export async function embedQuery(query) {
  const result = await client.embed({
    input: [query],
    model: config.voyageModel,
    inputType: 'query',
  });

  return result.data[0].embedding;
}
