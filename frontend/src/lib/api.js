const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
  try {
    const stored = localStorage.getItem('auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.token;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers,
  });
  if (response.status === 401) {
    localStorage.removeItem('auth');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Request failed (${response.status})`);
  }
  return response;
}

export async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Login failed');
  }
  return response.json();
}

export async function register(email, password, name) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Registration failed');
  }
  return response.json();
}

export async function queryContracts(question, conversationId) {
  const token = getToken();
  const response = await fetch(`${baseUrl}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, conversationId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Query failed');
  }
  return response.body.getReader();
}

export async function getDocuments() {
  const response = await fetchWithAuth('/api/documents');
  return response.json();
}

export async function getDocumentPdf(fileId) {
  const token = getToken();
  const response = await fetch(`${baseUrl}/api/documents/${fileId}/pdf`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch PDF');
  }
  return response.blob();
}

export async function triggerSync() {
  const response = await fetchWithAuth('/api/sync', {
    method: 'POST',
    body: '{}',
  });
  return response.json();
}
