import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalyzeFindingsPanel } from '../components/analyze/AnalyzeFindingsPanel'
import { useCopyFeedback } from '../presentation/useCopyFeedback'
import { VIRTUAL_LIST_THRESHOLD } from '../components/VirtualizedListColumn'

const copyFinding = { copy: vi.fn(async () => {}), status: null as string | null }

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
