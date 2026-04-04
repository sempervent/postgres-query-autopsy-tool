/** Test user ids for ProxyHeaders auth E2E; env must match API stack (see `.env.testing.proxy`). */
export const PROXY_USER_ID_A = (process.env.PQAT_PROXY_USER_ID_A ?? 'e2e-proxy-user-a').trim()
export const PROXY_USER_ID_B = (process.env.PQAT_PROXY_USER_ID_B ?? 'e2e-proxy-user-b').trim()

/** Defaults match AuthOptions / deployment-auth.md */
export const PROXY_USER_HEADER = (process.env.PQAT_PROXY_USER_HEADER ?? 'X-PQAT-User').trim()
export const PROXY_GROUPS_HEADER = (process.env.PQAT_PROXY_GROUPS_HEADER ?? 'X-PQAT-Groups').trim()
