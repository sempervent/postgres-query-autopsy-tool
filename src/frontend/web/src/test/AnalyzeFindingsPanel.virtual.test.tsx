import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { AnalyzeFindingsPanel } from '../components/analyze/AnalyzeFindingsPanel'
import { useCopyFeedback } from '../presentation/useCopyFeedback'
import { VIRTUAL_LIST_THRESHOLD } from '../components/VirtualizedListColumn'

const copyFinding = { copy: vi.fn(async () => {}), status: null as string | null }

afterEach(() => cleanup())

function makeFinding(i: number) {
  return {
    findingId: `f-${i}`,
    ruleId: 'r',
    severity: 1,
    confidence: 1,
    category: 0,
    title: `Title ${i}`,
    summary: 's',
    explanation: 'e',
    evidence: {},
    suggestion: 'sg',
    nodeIds: ['n1'],
  }
}

test('short findings list stays non-virtual (no scroll window aria)', () => {
  const n = Math.max(0, VIRTUAL_LIST_THRESHOLD - 1)
  const findings = Array.from({ length: n }, (_, i) => makeFinding(i))
  render(
    <AnalyzeFindingsPanel
      findingSearch=""
      setFindingSearch={() => {}}
      minSeverity={0}
      setMinSeverity={() => {}}
      filteredFindings={findings}
      selectedNodeId={null}
      jumpToNodeId={() => {}}
      byId={new Map()}
      copyFinding={copyFinding as ReturnType<typeof useCopyFeedback>}
    />,
  )
  expect(screen.queryByLabelText('Findings list (scroll for more)')).toBeNull()
})

test('graph pivot shows continuity hint beside Ranked eyebrow', () => {
  const findings = [makeFinding(0)]
  render(
    <AnalyzeFindingsPanel
      findingSearch=""
      setFindingSearch={() => {}}
      minSeverity={0}
      setMinSeverity={() => {}}
      filteredFindings={findings}
      selectedNodeId={null}
      graphPivotFindingId="f-0"
      rankedHandoffOrigin="session"
      jumpToNodeId={() => {}}
      byId={new Map()}
      copyFinding={copyFinding as ReturnType<typeof useCopyFeedback>}
    />,
  )
  expect(screen.getByText('Continues from plan')).toBeInTheDocument()
  const contract = screen.getByTestId('analyze-visual-ranked-continuation-contract')
  expect(contract).toBeInTheDocument()
  expect(contract).toHaveAttribute('role', 'region')
  expect(contract.getAttribute('aria-labelledby')).toBe('analyze-ranked-findings-heading')
  const hint = screen.getByTestId('analyze-ranked-handoff-hint')
  expect(contract.getAttribute('aria-describedby')).toBe(hint.id)
  expect(hint).toHaveAttribute('data-pqat-ranked-handoff-origin', 'session')
  const h2 = within(contract).getByRole('heading', { name: 'Findings' })
  expect(h2).not.toHaveAttribute('aria-describedby')
})

test('graph pivot after restored analysis uses reopened thread label', () => {
  const findings = [makeFinding(0)]
  render(
    <AnalyzeFindingsPanel
      findingSearch=""
      setFindingSearch={() => {}}
      minSeverity={0}
      setMinSeverity={() => {}}
      filteredFindings={findings}
      selectedNodeId={null}
      graphPivotFindingId="f-0"
      rankedHandoffOrigin="link"
      jumpToNodeId={() => {}}
      byId={new Map()}
      copyFinding={copyFinding as ReturnType<typeof useCopyFeedback>}
    />,
  )
  expect(screen.getByText('Continues from plan — reopened')).toBeInTheDocument()
  expect(screen.getByTestId('analyze-ranked-handoff-hint')).toHaveAttribute('data-pqat-ranked-handoff-origin', 'link')
})

test('restored analysis without graph pivot shows ranked band hint on root describedby', () => {
  const findings = [makeFinding(0)]
  const { container } = render(
    <AnalyzeFindingsPanel
      findingSearch=""
      setFindingSearch={() => {}}
      minSeverity={0}
      setMinSeverity={() => {}}
      filteredFindings={findings}
      selectedNodeId={null}
      rankedHandoffOrigin="link"
      jumpToNodeId={() => {}}
      byId={new Map()}
      copyFinding={copyFinding as ReturnType<typeof useCopyFeedback>}
    />,
  )
  const root = container.querySelector('#analyze-ranked-findings')
  expect(root).toBeTruthy()
  const restored = screen.getByTestId('analyze-ranked-restored-hint')
  expect(restored).toHaveTextContent(/Ranked — reopened/)
  expect(root!.getAttribute('aria-describedby')).toBe(restored.id)
})

test('long findings list uses virtual scroll region label and count hint', () => {
  const findings = Array.from({ length: VIRTUAL_LIST_THRESHOLD + 4 }, (_, i) => makeFinding(i))
  render(
    <AnalyzeFindingsPanel
      findingSearch=""
      setFindingSearch={() => {}}
      minSeverity={0}
      setMinSeverity={() => {}}
      filteredFindings={findings}
      selectedNodeId={null}
      jumpToNodeId={() => {}}
      byId={new Map()}
      copyFinding={copyFinding as ReturnType<typeof useCopyFeedback>}
    />,
  )
  expect(screen.getByLabelText('Findings list (scroll for more)')).toBeInTheDocument()
  expect(screen.getByText(new RegExp(`${findings.length} findings in a scrollable window`))).toBeInTheDocument()
})
