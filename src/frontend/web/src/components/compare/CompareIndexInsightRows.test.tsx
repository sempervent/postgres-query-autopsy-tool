import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PlanComparisonResult } from '../../api/types'
import type { CompareIndexSectionModel } from '../../presentation/comparePresentation'
import { CompareIndexInsightRows } from './CompareIndexInsightRows'

function row(
  id: string,
  kind: string,
  summary: string,
): CompareIndexSectionModel['topInsightDiffs'][number] {
  return {
    diffIndex: 0,
    insightDiffId: id,
    kindLabel: kind,
    summary,
    relatedFindingIndexes: [],
    relatedFindingDiffIds: [],
    relatedFindingHints: [],
  }
}

describe('CompareIndexInsightRows', () => {
  it('ArrowDown moves roving focus and Enter pins the focused insight', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {})
    const setHighlightIndexInsightDiffId = vi.fn()
    const setHighlightFindingDiffId = vi.fn()
    const setHighlightSuggestionId = vi.fn()

    const indexSection: CompareIndexSectionModel = {
      headlineNew: null,
      headlineResolved: null,
      overviewLines: [],
      topInsightDiffs: [row('ii_first', 'New', 'one'), row('ii_second', 'Resolved', 'two')],
      chunkedNuance: false,
    }

    const comparison = {
      comparisonId: 'cmp',
      findingsDiff: { items: [] },
    } as unknown as PlanComparisonResult

    render(
      <CompareIndexInsightRows
        indexSection={indexSection}
        comparison={comparison}
        highlightIndexInsightDiffId={null}
        setHighlightFindingDiffId={setHighlightFindingDiffId}
        setHighlightIndexInsightDiffId={setHighlightIndexInsightDiffId}
        setHighlightSuggestionId={setHighlightSuggestionId}
      />,
    )

    const first = screen.getByLabelText(/Index change: New/)
    const second = screen.getByLabelText(/Index change: Resolved/)
    expect(first).toHaveAttribute('tabIndex', '0')
    expect(second).toHaveAttribute('tabIndex', '-1')

    fireEvent.keyDown(first, { key: 'ArrowDown' })
    await waitFor(() => expect(second).toHaveAttribute('tabIndex', '0'))
    await waitFor(() => {
      expect(
        focusSpy.mock.calls.some((args) => {
          const o = args[0] as FocusOptions | undefined
          return !!o && o.preventScroll === true
        }),
      ).toBe(true)
    })

    fireEvent.keyDown(second, { key: 'Enter' })
    expect(setHighlightIndexInsightDiffId).toHaveBeenCalledWith('ii_second')
    expect(setHighlightFindingDiffId).toHaveBeenCalledWith(null)
    expect(setHighlightSuggestionId).toHaveBeenCalledWith(null)
    focusSpy.mockRestore()
  })

  it('when highlightIndexInsightDiffId updates from the URL, roving tabIndex follows and focus uses preventScroll', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {})

    const setHighlightIndexInsightDiffId = vi.fn()
    const setHighlightFindingDiffId = vi.fn()
    const setHighlightSuggestionId = vi.fn()

    const indexSection: CompareIndexSectionModel = {
      headlineNew: null,
      headlineResolved: null,
      overviewLines: [],
      topInsightDiffs: [row('ii_first', 'New', 'one'), row('ii_second', 'Resolved', 'two')],
      chunkedNuance: false,
    }

    const comparison = {
      comparisonId: 'cmp',
      findingsDiff: { items: [] },
    } as unknown as PlanComparisonResult

    const { container, rerender } = render(
      <CompareIndexInsightRows
        indexSection={indexSection}
        comparison={comparison}
        highlightIndexInsightDiffId={null}
        setHighlightFindingDiffId={setHighlightFindingDiffId}
        setHighlightIndexInsightDiffId={setHighlightIndexInsightDiffId}
        setHighlightSuggestionId={setHighlightSuggestionId}
      />,
    )

    rerender(
      <CompareIndexInsightRows
        indexSection={indexSection}
        comparison={comparison}
        highlightIndexInsightDiffId="ii_second"
        setHighlightFindingDiffId={setHighlightFindingDiffId}
        setHighlightIndexInsightDiffId={setHighlightIndexInsightDiffId}
        setHighlightSuggestionId={setHighlightSuggestionId}
      />,
    )

    await waitFor(() => {
      const first = container.querySelector('[data-artifact-id="ii_first"]')
      const second = container.querySelector('[data-artifact-id="ii_second"]')
      expect(first).toHaveAttribute('tabindex', '-1')
      expect(second).toHaveAttribute('tabindex', '0')
    })

    await waitFor(() => {
      expect(
        focusSpy.mock.calls.some((args) => {
          const o = args[0] as FocusOptions | undefined
          return !!o && o.preventScroll === true
        }),
      ).toBe(true)
    })

    focusSpy.mockRestore()
  })
})
