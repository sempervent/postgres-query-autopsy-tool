import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, within } from '@testing-library/react'
import { AnalyzeLocalFindingsShelf } from './AnalyzeLocalFindingsShelf'
import type { AnalysisFinding } from '../../api/types'

function F(id: string, title: string): AnalysisFinding {
  return {
    findingId: id,
    ruleId: 'r',
    category: 0,
    title,
    summary: 's',
    explanation: 'e',
    suggestion: 'sg',
    severity: 1,
    confidence: 1,
    nodeIds: ['n1'],
    evidence: {},
  }
}

describe('AnalyzeLocalFindingsShelf', () => {
  it('shows truncation cue when more findings than preview slots', () => {
    const findings = [F('a', 'A'), F('b', 'B'), F('c', 'C')]
    const { container } = render(
      <AnalyzeLocalFindingsShelf variant="workspace" findings={findings} onSeeInRankedList={() => {}} testId="test-shelf" />,
    )
    expect(within(container).getByTestId('analyze-local-evidence-truncation-cue')).toHaveTextContent(/Previews 2 of 3/)
  })

  it('omits truncation cue when all findings fit previews', () => {
    const { container } = render(
      <AnalyzeLocalFindingsShelf variant="workspace" findings={[F('a', 'A'), F('b', 'B')]} onSeeInRankedList={() => {}} />,
    )
    expect(within(container).queryByTestId('analyze-local-evidence-truncation-cue')).toBeNull()
  })

  it('invokes onSeeInRankedList from Open in ranked list', () => {
    const onSee = vi.fn()
    const { container } = render(<AnalyzeLocalFindingsShelf variant="workspace" findings={[F('x', 'X')]} onSeeInRankedList={onSee} />)
    fireEvent.click(within(container).getByTestId('analyze-local-findings-shelf-see-x'))
    expect(onSee).toHaveBeenCalledWith('x')
  })

  it('compact workspace preview uses shorter Ranked CTA copy', () => {
    const { container } = render(
      <AnalyzeLocalFindingsShelf
        variant="workspace"
        compactWorkspacePreview
        findings={[F('x', 'X')]}
        onSeeInRankedList={() => {}}
      />,
    )
    expect(within(container).getByText('Full write-up in Ranked')).toBeInTheDocument()
    expect(within(container).getByText('More in Ranked')).toBeInTheDocument()
  })
})
