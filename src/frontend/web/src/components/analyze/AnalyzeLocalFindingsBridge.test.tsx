import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnalyzeLocalFindingsBridge } from './AnalyzeLocalFindingsBridge'
import type { AnalysisFinding } from '../../api/types'

afterEach(() => {
  cleanup()
})

function F(partial: Partial<AnalysisFinding> & { findingId: string }): AnalysisFinding {
  return {
    findingId: partial.findingId,
    ruleId: partial.ruleId ?? 'r',
    category: partial.category ?? 0,
    title: partial.title ?? 't',
    summary: partial.summary ?? 's',
    explanation: partial.explanation ?? 'e',
    suggestion: partial.suggestion ?? 'sg',
    severity: partial.severity ?? 1,
    confidence: partial.confidence ?? 1,
    nodeIds: partial.nodeIds ?? ['n1'],
    evidence: partial.evidence ?? ({} as Record<string, unknown>),
  }
}

describe('AnalyzeLocalFindingsBridge', () => {
  it('renders empty hint when no findings', () => {
    render(<AnalyzeLocalFindingsBridge findings={[]} onSeeInRankedList={() => {}} />)
    expect(screen.getByTestId('analyze-local-evidence-bridge-empty')).toHaveTextContent(/Nothing in Ranked/)
  })

  it('single finding: points to Ranked without repeating the finding title', () => {
    render(<AnalyzeLocalFindingsBridge findings={[F({ findingId: 'a', title: 'Only one', severity: 3 })]} onSeeInRankedList={() => {}} />)
    const root = screen.getByTestId('analyze-local-evidence-bridge')
    expect(root.className).toContain('pqat-localEvidenceBridge--single')
    expect(screen.queryByText('Only one')).toBeNull()
    expect(screen.getByText(/plan band above states the issue/i)).toBeInTheDocument()
    expect(screen.getByText('Full write-up in Ranked')).toBeInTheDocument()
  })

  it('calls onSeeInRankedList with sole finding when Open in ranked list is clicked', () => {
    const onSee = vi.fn()
    render(<AnalyzeLocalFindingsBridge findings={[F({ findingId: 'solo', title: 'S' })]} onSeeInRankedList={onSee} />)
    fireEvent.click(screen.getByTestId('analyze-local-evidence-open-top-in-list'))
    expect(onSee).toHaveBeenCalledWith('solo')
  })

  it('multiple findings: shows max severity summary and strongest write-up CTA', () => {
    render(
      <AnalyzeLocalFindingsBridge
        findings={[F({ findingId: 'a', title: 'Alpha', severity: 1 }), F({ findingId: 'b', title: 'Beta', severity: 3 })]}
        onSeeInRankedList={() => {}}
      />,
    )
    expect(screen.getByText('Up to High')).toBeInTheDocument()
    expect(screen.getByText(/2 issues cite this operator/i)).toBeInTheDocument()
    expect(screen.getByText('Open strongest write-up in Ranked')).toBeInTheDocument()
    expect(screen.getByTestId('analyze-local-evidence-open-top-in-list')).toHaveAccessibleName(/Open strongest finding in ranked list/i)
  })

  it('calls onSeeInRankedList with top finding when Open strongest is clicked', () => {
    const onSee = vi.fn()
    render(
      <AnalyzeLocalFindingsBridge
        findings={[F({ findingId: 'a', title: 'Alpha' }), F({ findingId: 'b', title: 'Beta' })]}
        onSeeInRankedList={onSee}
      />,
    )
    fireEvent.click(screen.getByTestId('analyze-local-evidence-open-top-in-list'))
    expect(onSee).toHaveBeenCalledWith('a')
  })
})
