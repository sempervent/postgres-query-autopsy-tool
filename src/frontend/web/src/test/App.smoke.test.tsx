import { expect, test } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { waitForAnalyzeAppReady, waitForCompareAppReady } from './waitForLazyApp'

test('renders analyze page', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  await waitForAnalyzeAppReady()
  expect(screen.getAllByRole('heading', { name: 'Input plan' }).length).toBeGreaterThan(0)
})

test('analyze page does not leak raw root.* ids by default', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  await waitForAnalyzeAppReady()
  expect(screen.getAllByRole('heading', { name: 'Input plan' }).length).toBeGreaterThan(0)
  // With no analysis loaded, UI should not show internal ids.
  expect(screen.queryByText(/root\.\d+/)).toBeNull()
})

test('compare route highlights Compare nav and shows plan inputs chrome', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )

  // StrictMode double-mount can leave transient duplicate trees; `aria-current` marks the real active nav item.
  const compareNav = await screen.findByRole('link', { name: 'Compare', current: 'page' })
  expect(compareNav.className).toContain('navLink--active')
  await waitForCompareAppReady()
  expect(screen.getAllByRole('heading', { name: 'Plan inputs' }).length).toBeGreaterThan(0)
})

test('compare optional EXPLAIN details opens with workstation fields', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )

  await waitForCompareAppReady()
  const planPanel = screen.getAllByRole('heading', { name: 'Plan inputs' })[0]!.closest('.pqat-panel')! as HTMLElement
  const optSummary = within(planPanel)
    .getAllByText('Optional: source SQL + EXPLAIN metadata (per side)')
    .find((el) => el.tagName === 'SUMMARY')
  expect(optSummary).toBeTruthy()
  fireEvent.click(optSummary!)
  expect(
    (await screen.findAllByLabelText(/Send EXPLAIN options with compare request/i, { exact: false }))[0],
  ).toBeInTheDocument()
})

test('workspace customizer loads reorder list after opening details', async () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <App />
    </MemoryRouter>,
  )

  await waitForCompareAppReady()
  const planHeading = screen.getAllByRole('heading', { name: 'Plan inputs' })[0]!
  const capturePanel = planHeading.closest('.pqat-panel')! as HTMLElement
  const summarize = within(capturePanel)
    .getAllByText(/Customize workspace layout/i)
    .find((el) => el.tagName === 'SUMMARY')
  expect(summarize).toBeTruthy()
  const det = summarize!.closest('details') as HTMLDetailsElement
  if (!det.open) fireEvent.click(summarize!)
  await waitFor(
    () => {
      const h = screen.getAllByRole('heading', { name: 'Plan inputs' })[0]!
      const panel = h.closest('.pqat-panel')!
      const d = panel.querySelector('details.pqat-customizer')
      expect(d?.querySelector('legend')?.textContent).toMatch(/Presets/i)
    },
    { timeout: 15_000 },
  )
})


