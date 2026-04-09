import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnalyzeWorkflowGuide } from './AnalyzeWorkflowGuide'
import { CompareWorkflowGuide } from './CompareWorkflowGuide'
import { WorkflowGuideBar } from './WorkflowGuideBar'

afterEach(() => cleanup())

test('Analyze workflow guide exposes practical sections and is not confused with findings UI', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AnalyzeWorkflowGuide panelId="p" testId="g" />
    </MemoryRouter>,
  )
  const shell = screen.getByTestId('g')
  expect(shell).toHaveClass('pqat-help-shell')
  expect(shell).not.toHaveClass('pqat-panel')
  expect(shell).not.toHaveClass('pqat-panel--capture')
  expect(shell).toHaveAttribute('data-pqat-help-surface', '1')
  expect(screen.getByText(/Guide — not plan analysis/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /Analyze a plan/i })).toBeInTheDocument()
  expect(screen.getByText(/What to paste/i)).toBeInTheDocument()
  expect(screen.getByText(/How to read results/i)).toBeInTheDocument()
})

test('Analyze workflow guide includes copy guided link for support handoff', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AnalyzeWorkflowGuide testId="ag-guided-copy" />
    </MemoryRouter>,
  )
  expect(within(screen.getByTestId('ag-guided-copy')).getByRole('button', { name: /Copy guided link/i })).toBeInTheDocument()
  expect(screen.getByTestId('ag-guided-copy')).toHaveTextContent(/current address/i)
  expect(screen.getByTestId('ag-guided-copy')).toHaveTextContent(/guide/i)
})

test('Compare workflow guide keeps Compare plans heading for wayfinding', () => {
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <CompareWorkflowGuide testId="cg" />
    </MemoryRouter>,
  )
  expect(screen.getByTestId('cg')).toHaveClass('pqat-help-shell')
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
