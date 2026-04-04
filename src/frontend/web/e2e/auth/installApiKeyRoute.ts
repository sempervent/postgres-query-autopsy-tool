import type { Page } from '@playwright/test'
import { E2E_API_KEY_HEADER } from './constants'

/**
 * Ensures SPA `fetch()` to `/api/*` carries the API key. Playwright `extraHTTPHeaders`
 * is not reliable for all subresource/fetch paths in every browser build; routing does.
 */
export async function installApiKeyRoute(page: Page, rawKey: string): Promise<void> {
  const key = rawKey.trim()
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const req = route.request()
      const headers = { ...req.headers(), [E2E_API_KEY_HEADER]: key }
      await route.continue({ headers })
    },
  )
}
