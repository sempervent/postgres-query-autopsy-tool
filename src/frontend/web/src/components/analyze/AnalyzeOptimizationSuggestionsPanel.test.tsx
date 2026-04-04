import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnalyzedPlanNode, OptimizationSuggestion } from '../../api/types'
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
})
