import type { Page } from '@playwright/test'

/**
 * Injects `Authorization: Bearer …` on SPA `fetch()` to `/api/*` (mirrors `installApiKeyRoute` for JWT mode).
 */
export async function installBearerRoute(page: Page, rawJwt: string): Promise<void> {
  const token = rawJwt.trim()
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const req = route.request()
      const headers = { ...req.headers(), Authorization: `Bearer ${token}` }
      await route.continue({ headers })
    },
  )
}
