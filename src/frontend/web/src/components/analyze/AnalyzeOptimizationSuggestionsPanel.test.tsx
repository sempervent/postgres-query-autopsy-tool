import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnalyzedPlanNode, OptimizationSuggestion, PlanBottleneckInsight } from '../../api/types'
import * as copyModule from '../../presentation/copyToClipboard'
import { AnalyzeOptimizationSuggestionsPanel } from './AnalyzeOptimizationSuggestionsPanel'

vi.mock('../VirtualizedListColumn', () => ({
  VIRTUAL_LIST_THRESHOLD: 36,
  VirtualizedListColumn: function MockVirtualizedListColumn(props: {
    count: number
    children: (index: number) => ReactNode
  }) {
    return (
      <div data-testid="virtual-suggestion-list">
        {Array.from({ length: props.count }, (_, i) => (
          <div key={i} data-row-index={i}>
            {props.children(i)}
          </div>
        ))}
      </div>
    )
  },
}))

function baseSuggestion(overrides: Partial<OptimizationSuggestion>): OptimizationSuggestion {
  return {
    suggestionId: 'x',
    category: 'sort_ordering',
    suggestedActionType: 'review_sort',
    title: 't',
    summary: 's',
    details: '',
    rationale: 'r',
    confidence: 'medium',
    priority: 'medium',
    targetNodeIds: [],
    relatedFindingIds: [],
    relatedIndexInsightNodeIds: [],
    cautions: [],
    validationSteps: [],
    ...overrides,
  }
}

describe('AnalyzeOptimizationSuggestionsPanel grouped + virtual rows', () => {
  it('renders family section headers for each group when virtualized (flattened rows)', () => {
    const items: OptimizationSuggestion[] = []
    for (let i = 0; i < 6; i++) {
      items.push(
        baseSuggestion({
          suggestionId: `st-${i}`,
          category: 'statistics_maintenance',
          suggestedActionType: 'analyze_table',
          title: `Stats ${i}`,
        }),
      )
    }
    for (let i = 0; i < 6; i++) {
      items.push(
        baseSuggestion({
          suggestionId: `ix-${i}`,
          category: 'index_experiment',
          suggestedActionType: 'create_index_candidate',
          title: `Index ${i}`,
        }),
      )
    }

    const byId = new Map<string, AnalyzedPlanNode>()
    render(
      <AnalyzeOptimizationSuggestionsPanel
        sortedOptimizationSuggestions={items}
        expandedOptimizationId={null}
        setExpandedOptimizationId={() => {}}
        jumpToNodeId={() => {}}
        byId={byId}
        nodeLabel={(n) => n.nodeId}
      />,
    )

    const list = screen.getByTestId('virtual-suggestion-list')
    const headers = list.querySelectorAll('.pqat-suggestionVirtualHeader')
    expect(headers.length).toBe(2)
    expect(headers[0]?.textContent).toBe('Statistics & planner accuracy')
    expect(headers[1]?.textContent).toBe('Index experiments')
  })

  it('shows bottleneck tie-in when relatedBottleneckInsightIds resolves against bottlenecks', () => {
    const bottlenecks: PlanBottleneckInsight[] = [
      {
        insightId: 'bn_1',
        rank: 1,
        kind: 'time_exclusive',
        bottleneckClass: 'sortOrSpillPressure',
        causeHint: 'downstreamSymptom',
        headline: 'Heavy sort under root',
        detail: 'd',
        nodeIds: ['n1'],
        relatedFindingIds: [],
      },
    ]
    const s = baseSuggestion({
      suggestionId: 'sg1',
      title: 'Review sort inputs',
      relatedBottleneckInsightIds: ['bn_1'],
    })
    render(
      <AnalyzeOptimizationSuggestionsPanel
        sortedOptimizationSuggestions={[s]}
        expandedOptimizationId={null}
        setExpandedOptimizationId={() => {}}
        jumpToNodeId={() => {}}
        byId={new Map()}
        nodeLabel={(n) => n.nodeId}
        bottlenecks={bottlenecks}
      />,
    )
    expect(screen.getByLabelText('Linked bottleneck')).toBeInTheDocument()
    expect(screen.getByText(/Because of bottleneck/i)).toBeInTheDocument()
    expect(screen.getByText(/Heavy sort under root/)).toBeInTheDocument()
    expect(screen.getByLabelText('Jump to bottleneck rank 1 in plan')).toBeInTheDocument()
  })

  it('Copy for ticket invokes clipboard helper with structured payload', async () => {
    const spy = vi.spyOn(copyModule, 'copyToClipboard').mockResolvedValue(undefined)
    const s = baseSuggestion({
      suggestionId: 'sg-copy',
      title: 'Ticket title',
    })
    render(
      <AnalyzeOptimizationSuggestionsPanel
        sortedOptimizationSuggestions={[s]}
        expandedOptimizationId={null}
        setExpandedOptimizationId={() => {}}
        jumpToNodeId={() => {}}
        byId={new Map()}
        nodeLabel={(n) => n.nodeId}
        analysisId="aid-99"
      />,
    )
    const card = screen.getByText('Ticket title').closest('.pqat-listRow')
    expect(card).toBeTruthy()
    fireEvent.click(within(card as HTMLElement).getByTestId('analyze-suggestion-copy-ticket'))
    expect(spy).toHaveBeenCalledTimes(1)
    const payload = String(spy.mock.calls[0]?.[0])
    expect(payload).toContain('PQAT analysis: aid-99')
    expect(payload).toContain('Ticket title')
    expect(payload).toContain('[sg-copy]')
    spy.mockRestore()
  })
})
