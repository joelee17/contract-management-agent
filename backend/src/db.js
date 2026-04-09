import pg from 'pg';
import pgvector from 'pgvector/pg';
import config from './config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Register pgvector types so parameterized queries work with vector columns
pool.on('connect', (client) => {
  pgvector.registerType(client);
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

export async function getClient() {
  return pool.connect();
}

export async function initDb() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      name        TEXT,
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS indexed_files (
      file_id        TEXT PRIMARY KEY,
      file_name      TEXT NOT NULL,
      mime_type      TEXT,
      modified_time  TIMESTAMPTZ,
      chunk_count    INTEGER DEFAULT 0,
      indexed_at     TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id                  BIGSERIAL PRIMARY KEY,
      file_id             TEXT NOT NULL,
      file_name           TEXT NOT NULL,
      chunk_text          TEXT NOT NULL,
      chunk_index         INTEGER NOT NULL,
      page_number         INTEGER,
      section_heading     TEXT,
      char_offset_start   INTEGER,
      char_offset_end     INTEGER,
      embedding           vector(${config.embeddingDimension}) NOT NULL,
      metadata            JSONB DEFAULT '{}',
      created_at          TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id),
      title       TEXT,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id              SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content         TEXT NOT NULL,
      sources         JSONB DEFAULT '[]',
      created_at      TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      color      TEXT NOT NULL DEFAULT '#6366f1',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_tags (
      file_id  TEXT NOT NULL REFERENCES indexed_files(file_id) ON DELETE CASCADE,
      tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (file_id, tag_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS folders (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE indexed_files
    ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL
  `);

  // Create vector index if it doesn't exist (idempotent check)
  const indexExists = await pool.query(`
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'document_chunks_embedding_idx'
  `);
  if (indexExists.rows.length === 0) {
    await pool.query(`
      CREATE INDEX document_chunks_embedding_idx
      ON document_chunks USING hnsw (embedding vector_cosine_ops)
    `);
  }

  console.log('Database initialized');
}

export default { query, getClient, initDb };
