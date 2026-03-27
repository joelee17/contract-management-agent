import { google } from 'googleapis';
import config from '../config.js';

let renewalTimer = null;

/**
 * Create an authenticated Google Drive client from the base64-encoded
 * service account key stored in config.
 */
export function getDriveClient() {
  const keyJson = JSON.parse(
    Buffer.from(config.googleServiceAccountKey, 'base64').toString('utf-8'),
  );

  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * List files in the configured Google Drive folder.
 */
export async function listFiles() {
  const drive = getDriveClient();
  const files = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${config.googleDriveFolderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      pageSize: 100,
      pageToken,
    });

    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
}

/**
 * Download file content as a Buffer.
 */
export async function downloadFile(fileId) {
  const drive = getDriveClient();

  // First get metadata to check if it's a Google Workspace file
  const meta = await drive.files.get({
    fileId,
    fields: 'mimeType',
  });

  const mimeType = meta.data.mimeType;
  let res;

  if (mimeType === 'application/vnd.google-apps.document') {
    // Export Google Docs as DOCX
    res = await drive.files.export(
      { fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { responseType: 'arraybuffer' },
    );
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    // Export Google Sheets as CSV
    res = await drive.files.export(
      { fileId, mimeType: 'text/csv' },
      { responseType: 'arraybuffer' },
    );
  } else {
    // Binary download for PDFs, DOCX, etc.
    res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
  }

  return Buffer.from(res.data);
}

/**
 * Get metadata for a single file.
 */
export async function getFileMetadata(fileId) {
  const drive = getDriveClient();

  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, modifiedTime, size',
  });

  return res.data;
}

/**
 * Register a push-notification channel with Google Drive to watch for
 * changes in the configured folder. Sets up an automatic renewal interval.
 */
export async function startWatchChannel() {
  const drive = getDriveClient();

  // Get start page token
  const startTokenRes = await drive.changes.getStartPageToken({});
  const startPageToken = startTokenRes.data.startPageToken;

  const channelId = `contract-agent-${Date.now()}`;
  const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  const res = await drive.changes.watch({
    pageToken: startPageToken,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: `${config.webhookBaseUrl}/api/webhooks/drive`,
      expiration: String(expiration),
    },
  });

  console.log(`Drive watch channel registered: ${channelId}`);

  // Renew the channel every 6 days (before the 7-day expiry)
  if (renewalTimer) clearInterval(renewalTimer);
  renewalTimer = setInterval(
    () => {
      startWatchChannel().catch((err) =>
        console.error('Failed to renew Drive watch channel:', err),
      );
    },
    6 * 24 * 60 * 60 * 1000,
  );

  return { channelId, startPageToken, resourceId: res.data.resourceId };
}

/**
 * Retrieve changes from Google Drive since the given page token.
 */
export async function getChanges(pageToken) {
  const drive = getDriveClient();
  const changes = [];
  let currentToken = pageToken;

  do {
    const res = await drive.changes.list({
      pageToken: currentToken,
      fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, parents))',
      pageSize: 100,
    });

    changes.push(...(res.data.changes || []));

    if (res.data.newStartPageToken) {
      return { changes, newStartPageToken: res.data.newStartPageToken };
    }
    currentToken = res.data.nextPageToken;
  } while (currentToken);

  return { changes, newStartPageToken: currentToken };
}
