import type { Page } from '@playwright/test'
import { PROXY_GROUPS_HEADER, PROXY_USER_HEADER } from './proxyHeadersConfig'

export type ProxyHeadersForRoute = {
  userId: string
  /** Comma-separated group ids, or omit for no groups header */
  groups?: string
}

/**
 * Injects trusted-proxy identity headers on SPA `fetch()` to `/api/*`, mirroring an authenticated edge.
 * Header names default to X-PQAT-User / X-PQAT-Groups (see Auth:ProxyUserIdHeader).
 */
export async function installProxyHeadersRoute(page: Page, identity: ProxyHeadersForRoute): Promise<void> {
  const uid = identity.userId.trim()
  const headers: Record<string, string> = {
    [PROXY_USER_HEADER]: uid,
  }
  if (identity.groups !== undefined && identity.groups.length > 0) {
    headers[PROXY_GROUPS_HEADER] = identity.groups
  }

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const req = route.request()
      await route.continue({
        headers: { ...req.headers(), ...headers },
      })
    },
  )
}
