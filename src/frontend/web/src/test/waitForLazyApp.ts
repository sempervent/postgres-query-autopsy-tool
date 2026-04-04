import { screen } from '@testing-library/react'

/** Route-level `React.lazy` + Suspense: wait until the page chunk mounted (StrictMode may duplicate headings). */
const LAZY_TIMEOUT_MS = 30_000

export async function waitForAnalyzeAppReady() {
  await screen.findAllByRole('heading', { name: 'Input plan' }, { timeout: LAZY_TIMEOUT_MS })
}

export async function waitForCompareAppReady() {
  await screen.findAllByRole('heading', { name: 'Plan inputs' }, { timeout: LAZY_TIMEOUT_MS })
}
