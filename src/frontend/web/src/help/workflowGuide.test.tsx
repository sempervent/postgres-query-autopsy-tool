import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnalyzeWorkflowGuide } from './AnalyzeWorkflowGuide'
import { CompareWorkflowGuide } from './CompareWorkflowGuide'
import { WorkflowGuideBar } from './WorkflowGuideBar'

afterEach(() => cleanup())

test('Analyze workflow guide can show try-example slot without breaking regions', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AnalyzeWorkflowGuide panelId="p" testId="g-ex" examplePicker={<button type="button">Demo chip</button>} />
    </MemoryRouter>,
  )
  expect(screen.getByTestId('analyze-guide-example-entry')).toContainElement(screen.getByRole('button', { name: 'Demo chip' }))
  expect(screen.getByText(/Sample plans/i)).toBeInTheDocument()
})

test('Analyze workflow guide exposes practical sections and is not confused with findings UI', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AnalyzeWorkflowGuide panelId="p" testId="g" />
    </MemoryRouter>,
  )
  const shell = screen.getByTestId('g')
  expect(shell).toHaveClass('pqat-help-shell')
  expect(shell).toHaveAttribute('role', 'region')
  expect(screen.getByRole('region', { name: /Analyze a plan/i })).toBe(shell)
  expect(shell).not.toHaveClass('pqat-panel')
  expect(shell).not.toHaveClass('pqat-panel--capture')
  expect(shell).toHaveAttribute('data-pqat-help-surface', '1')
  expect(shell).toHaveAttribute('data-pqat-help-visual-contract', '1')
  expect(screen.getByText(/Guide — not plan analysis/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /Analyze a plan/i })).toBeInTheDocument()
  const foot = shell.querySelector('.pqat-help-shell__footer')
  expect(foot).toBeTruthy()
  expect(foot).toHaveAttribute('role', 'group')
  expect(foot).toHaveAttribute('aria-label', 'Guided link sharing')
  expect(screen.getByText(/What to paste/i)).toBeInTheDocument()
  expect(screen.getByText(/How to read results/i)).toBeInTheDocument()
})

test('Analyze workflow guide includes copy guided link for support handoff', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AnalyzeWorkflowGuide testId="ag-guided-copy" />
    </MemoryRouter>,
  )
  const guided = screen.getByTestId('ag-guided-copy')
  expect(within(guided).getByTestId('analyze-workflow-guide-copy-guided-merged')).toBeInTheDocument()
  expect(within(guided).getByTestId('analyze-workflow-guide-copy-guided-entry')).toBeInTheDocument()
  expect(guided).toHaveTextContent(/Merged/i)
  expect(guided).toHaveTextContent(/Entry/i)
  expect(guided).toHaveTextContent(/guide/i)
})

test('Compare workflow guide keeps Compare plans heading for wayfinding', () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <CompareWorkflowGuide testId="cg" />
    </MemoryRouter>,
  )
  const cg = screen.getByTestId('cg')
  expect(cg).toHaveClass('pqat-help-shell')
  expect(cg).toHaveAttribute('role', 'region')
  expect(screen.getByRole('heading', { name: /^Compare plans$/ })).toBeInTheDocument()
  expect(screen.getByText(/Pins, links, and copy/i)).toBeInTheDocument()
})

test('Workflow guide bar toggle exposes expanded state to assistive tech', () => {
  render(
    <WorkflowGuideBar
      expanded={false}
      onToggle={() => {}}
      toggleCollapsedLabel="Open guide"
      toggleExpandedLabel="Close guide"
      panelId="guide-panel"
      testId="bar"
    />,
  )
  const btn = screen.getByRole('button', { name: 'Open guide' })
  expect(btn).toHaveAttribute('aria-expanded', 'false')
  expect(btn).toHaveAttribute('aria-controls', 'guide-panel')
})
