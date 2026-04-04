/**
 * Optional credentials for auth-mode deployments:
 * - `VITE_AUTH_API_KEY` → `X-Api-Key` (ApiKey mode)
 * - `VITE_AUTH_BEARER_TOKEN` → `Authorization: Bearer …` (legacy bearer or JWT)
 */
/** True when the SPA is built with credentials env vars (server may resolve identity). */
export function hasAuthFetchCredentials(): boolean {
  return Object.keys(authFetchHeaders()).length > 0
}

export function authFetchHeaders(): Record<string, string> {
  const apiKey = import.meta.env.VITE_AUTH_API_KEY
  if (apiKey && String(apiKey).trim().length > 0) {
    return { 'X-Api-Key': String(apiKey).trim() }
  }
  const token = import.meta.env.VITE_AUTH_BEARER_TOKEN
  if (token && String(token).trim().length > 0) {
    return { Authorization: `Bearer ${String(token).trim()}` }
  }
  return {}
}

export function jsonPostHeaders(): HeadersInit {
  return { 'content-type': 'application/json', ...authFetchHeaders() }
}

export function jsonGetHeaders(): HeadersInit {
  return { ...authFetchHeaders() }
}
