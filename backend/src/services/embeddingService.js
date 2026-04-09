import OpenAI from 'openai';
import config from '../config.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 512; // matches existing pgvector column size

/**
 * Embed an array of texts in a single batch request.
 * Returns an array of embedding vectors (number[][]).
 */
export async function embedTexts(texts) {
  if (texts.length === 0) return [];

  const result = await client.embeddings.create({
    input: texts,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return result.data.map((d) => d.embedding);
}

/**
 * Embed a single query string.
 * Returns one embedding vector (number[]).
 */
export async function embedQuery(query) {
  const result = await client.embeddings.create({
    input: [query],
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return result.data[0].embedding;
}
