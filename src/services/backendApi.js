import { ensureRemoteSession, firebaseReady } from './firebase';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    throw new Error(payload.error ?? 'Nao foi possivel concluir a requisicao.');
  }

  return payload.data ?? payload;
}

export async function requestBackend(path, options = {}) {
  let authorizationHeader = options.headers?.Authorization ?? options.headers?.authorization ?? null;

  if (!authorizationHeader && firebaseReady) {
    const user = await ensureRemoteSession().catch(() => null);
    const idToken = user ? await user.getIdToken().catch(() => '') : '';

    if (idToken) {
      authorizationHeader = `Bearer ${idToken}`;
    }
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  return parseResponse(response);
}
