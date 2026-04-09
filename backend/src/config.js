import dotenv from 'dotenv';
dotenv.config({ override: true });

export default {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',

  // Anthropic
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',

  // OpenAI Embeddings
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingDimension: 512,

  // Google Drive
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, // base64-encoded JSON
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,

  // Google Document AI (OCR)
  googleProjectId: process.env.GOOGLE_PROJECT_ID,
  googleDocumentAiProcessorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,

  // App
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL, // e.g. https://contract-agent-api.onrender.com
};
