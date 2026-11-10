/**
 * API client. The access token lives in memory only; the refresh token is an
 * HttpOnly cookie the browser sends to /api/auth/*. A 401 triggers one
 * (deduplicated) refresh and a single retry.
 */
import { trackLoad } from '@/lib/loading';
import type { Device } from '@/types';

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<string | null> | null = null;
let lastDevice: Device | null = null;

/** The device label from the most recent session restore. */
export const takeRestoredDevice = () => lastDevice;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn; };

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;
  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const CSRF = { 'X-Requested-With': 'SpendMate' };

async function parse(res: Response) {
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error?.message ?? 'Something went wrong', body?.error?.details);
  return body;
}

export function refreshSession(): Promise<string | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', headers: CSRF, credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = await res.json();
      accessToken = body.accessToken;
      lastDevice = body.device ?? null;
      return accessToken;
    })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const p = request<T>(path, init);
  // Reads (not saves) feed the progress bar, so a slow screen always shows that something is happening.
  return !init.method || init.method === 'GET' ? trackLoad(p) : p;
}

async function request<T>(path: string, init: RequestInit & { json?: unknown }): Promise<T> {
  const send = () => {
    const headers = new Headers(init.headers);
    if (init.json !== undefined) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(`/api${path}`, {
      ...init,
      headers,
      credentials: 'include',
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  };

  let res = await send();
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await send();
    else { onSessionLost?.(); }
  }
  return (await parse(res)) as T;
}

export const authPost = <T,>(path: string, json: unknown) => api<T>(`/auth${path}`, { method: 'POST', json });
export const logoutRequest = () => fetch('/api/auth/logout', { method: 'POST', headers: CSRF, credentials: 'include' });
