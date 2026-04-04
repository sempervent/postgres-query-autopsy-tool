/**
 * Phase 52: deterministic API keys / group id for auth-mode E2E.
 * Compose passes PQAT_* into the Playwright container; fallbacks match `.env.testing.auth`.
 */
export const E2E_SHARED_GROUP_ID = process.env.PQAT_E2E_SHARED_GROUP_ID ?? 'e2e-group-research'

export const E2E_KEY_USER_A = process.env.PQAT_E2E_API_KEY_USER_A ?? 'pqat-e2e-key-user-a'
export const E2E_KEY_USER_B = process.env.PQAT_E2E_API_KEY_USER_B ?? 'pqat-e2e-key-user-b'
export const E2E_KEY_USER_C = process.env.PQAT_E2E_API_KEY_USER_C ?? 'pqat-e2e-key-user-c'

/** Header must match API `Auth:ApiKey:HeaderName` (default X-Api-Key). */
export const E2E_API_KEY_HEADER = 'X-Api-Key'

export function apiKeyHeaders(key: string): Record<string, string> {
  return { [E2E_API_KEY_HEADER]: key }
}
