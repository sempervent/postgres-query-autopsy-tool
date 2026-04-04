/** Phase 53: JWT E2E env (compose passes PQAT_* into Playwright container). */
export const JWT_ISSUER = process.env.PQAT_JWT_ISSUER ?? 'pqat-e2e-jwt'
export const JWT_AUDIENCE = process.env.PQAT_JWT_AUDIENCE ?? 'pqat-e2e-api'
export const JWT_SIGNING_KEY_BASE64 =
  process.env.PQAT_JWT_SIGNING_KEY_BASE64 ?? 'cHFhdC1qd3QtZTJlLXNpZ24tc2VjcmV0LWtleS0zMmI='
export const JWT_SUB_A = process.env.PQAT_JWT_SUB_A ?? 'e2e-jwt-user-a'
export const JWT_SUB_B = process.env.PQAT_JWT_SUB_B ?? 'e2e-jwt-user-b'
