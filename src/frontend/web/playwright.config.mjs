import { defineConfig } from '@playwright/test'

/**
 * Phase 50 browser E2E (plain .mjs so `playwright test` never blocks on TS config transpile).
 * Phase 51: compose default = api + web only; testing profile = Playwright container (Chromium inside image).
 * Phase 52–54: `e2e-smoke` (non-auth), `e2e-auth-api-key`, `e2e-auth-jwt`, `e2e-auth-proxy` (trusted headers).
 * Each auth project needs the API started with the matching `.env.testing.*` — see `scripts/e2e-playwright-docker.sh`.
 *
 * Docker (recommended): `./scripts/e2e-playwright-docker.sh`, or:
 *   `docker compose --env-file .env.testing up -d --build api web`
 *   `docker compose --env-file .env.testing --profile testing run --rm playwright`
 *
 * Host Playwright against compose UI: after `docker compose up -d --build`, from `src/frontend/web`:
 *   `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e`
 * (E2E seed routes need `PQAT_E2E_ENABLED=true` on the API — use `.env.testing` when starting api.)
 *
 * Local Vite + API: API on 8080 with E2E__Enabled=true, `npm run dev`, then
 * `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e`
 *
 * Visual regression: `e2e-visual` — run against `.env.testing` stack; update snapshots on Linux (CI/Docker).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 25_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.04,
      animations: 'disabled',
    },
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      // Phase 72–73 + 77: persisted-flows (Analyze copy reference via init-script capture); theme-appearance is DOM theme smoke.
      name: 'e2e-smoke',
      testMatch: ['**/persisted-flows.spec.ts', '**/theme-appearance.spec.ts'],
    },
    { name: 'e2e-auth-api-key', testMatch: '**/auth-artifact-access.spec.ts' },
    { name: 'e2e-auth-jwt', testMatch: '**/jwt-auth-smoke.spec.ts' },
    { name: 'e2e-auth-proxy', testMatch: '**/proxy-auth-smoke.spec.ts' },
    {
      name: 'e2e-visual',
      testMatch: '**/visual/**/*.spec.ts',
      retries: 0,
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : process.env.PLAYWRIGHT_WEB_SERVER_VITE
      ? {
          command: 'npm run dev -- --host 127.0.0.1 --port 5173',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
      : undefined,
})
