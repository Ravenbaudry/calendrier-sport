// Client HTTP minimal : JSON + jeton JWT (header Authorization: Bearer).

const TOKEN_KEY = 'calendrier-sport.token';

export const tokenStore = {
  get: () => safeStorage(() => localStorage.getItem(TOKEN_KEY)),
  set: (token) => safeStorage(() => localStorage.setItem(TOKEN_KEY, token)),
  clear: () => safeStorage(() => localStorage.removeItem(TOKEN_KEY)),
};

function safeStorage(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Serveur injoignable. Vérifie ta connexion au VPN.');
  }

  // Jeton expiré/révoqué : on déconnecte proprement toute l'application.
  if (res.status === 401 && token) {
    tokenStore.clear();
    window.dispatchEvent(new Event('auth:logout'));
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const details = data?.details;
    const firstDetail = Array.isArray(details) && details[0]?.message;
    throw new ApiError(res.status, firstDetail || data?.error || `Erreur ${res.status}`, details);
  }
  return data;
}

// Raccourcis
export const get = (path, options) => api(path, options);
export const post = (path, body) => api(path, { method: 'POST', body: body ?? {} });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });
