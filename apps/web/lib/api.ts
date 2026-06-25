const DEFAULT_API_URL = 'http://localhost:3001/api';
const WEB_DEV_ORIGINS = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function ensureApiPrefix(value: string) {
  const normalized = trimTrailingSlash(value);
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

function normalizeApiBaseUrl(value?: string) {
  const raw = (value ?? '').trim().replace(/^['"]|['"]$/g, '');

  if (!raw) return DEFAULT_API_URL;

  if (raw.startsWith('/')) {
    return ensureApiPrefix('http://localhost:3001');
  }

  const withProtocol = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `http://${raw}`;

  try {
    const url = new URL(withProtocol);
    const origin = `${url.protocol}//${url.host}`;

    if (WEB_DEV_ORIGINS.has(origin)) {
      return DEFAULT_API_URL;
    }

    return ensureApiPrefix(`${origin}${url.pathname}`);
  } catch {
    return DEFAULT_API_URL;
  }
}

const API_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseErrorMessage(response: Response) {
  const fallback = `Erro ${response.status} ao comunicar com a API.`;
  try {
    const text = await response.text();
    if (!text) return fallback;

    if (text.includes('Cannot GET /api/')) {
      return `${text}. Verifique se NEXT_PUBLIC_API_URL aponta para http://localhost:3001/api e reinicie o Next.js após alterar o .env.`;
    }

    try {
      const json = JSON.parse(text) as { message?: string | string[]; error?: string };
      if (Array.isArray(json.message)) return json.message.join(' ');
      return json.message || json.error || text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

function normalizeApiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function buildApiUrl(path: string) {
  return `${API_URL}${normalizeApiPath(path)}`;
}

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function api(path: string, options: RequestInit = {}) {
  return request(path, options);
}

export async function authApi(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('financas_token') : null;
  if (!token) throw new ApiError('Sessão não encontrada. Faça login novamente.', 401);

  return api(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
