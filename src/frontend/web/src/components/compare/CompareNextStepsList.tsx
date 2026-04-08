import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import type { OptimizationSuggestion, PlanComparisonResult } from '../../api/types'
import { ArtifactDomKind } from '../../presentation/artifactLinks'
import {
  compareSuggestionAnchorsSelectedPlanB,
  optimizationCategoryLabel,
  suggestionConfidenceShort,
  suggestionFamilyLabel,
  suggestionPriorityShort,
  suggestionReferenceText,
} from '../../presentation/optimizationSuggestionsPresentation'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'
import { humanNodeAnchorFromPlan } from '../../presentation/planReferencePresentation'
import { prefetchCompareSelectedPairHeavySections } from './prefetchCompareSelectedPairHeavySections'

export type CompareNextStepsListProps = {
  comparison: PlanComparisonResult
  compareOptimizationTop: OptimizationSuggestion[]
  selectedPlanBNodeId: string | null
  selectedPairArtifactId: string | null
  highlightSuggestionId: string | null
  setHighlightFindingDiffId: (id: string | null) => void
  setHighlightIndexInsightDiffId: (id: string | null) => void
  setHighlightSuggestionId: (id: string | null) => void
  setSelectedPair: (p: { a: string; b: string }) => void
  copyCompareSuggestion: ReturnType<typeof useCopyFeedback>
}

export function CompareNextStepsList(props: CompareNextStepsListProps) {
  const {
    comparison,
    compareOptimizationTop,
    selectedPlanBNodeId,
    selectedPairArtifactId,
    highlightSuggestionId,
    setHighlightFindingDiffId,
    setHighlightIndexInsightDiffId,
    setHighlightSuggestionId,
    setSelectedPair,
    copyCompareSuggestion,
  } = props

  const pinRefs = useRef<(HTMLButtonElement | null)[]>([])
  useLayoutEffect(() => {
    pinRefs.current = pinRefs.current.slice(0, compareOptimizationTop.length)
  }, [compareOptimizationTop.length])

  function onPinKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const n = compareOptimizationTop.length
    if (e.key === 'ArrowDown') {
      const next = pinRefs.current[index + 1]
      if (next) {
        e.preventDefault()
        next.focus()
      }
    } else if (e.key === 'ArrowUp') {
      const prev = pinRefs.current[index - 1]
      if (prev) {
        e.preventDefault()
        prev.focus()
      }
    } else if (e.key === 'Home') {
      const first = pinRefs.current[0]
      if (first && index !== 0) {
        e.preventDefault()
        first.focus()
      }
    } else if (e.key === 'End') {
      const last = pinRefs.current[n - 1]
      if (last && index !== n - 1) {
        e.preventDefault()
        last.focus()
      }
    }
  }

  return (
    <>
      <ul
        className="pqat-bulletList pqat-nextStepsPinList"
        aria-label="Next steps — Pin sets one primary highlight for Copy link; Arrow Up or Down, Home, or End moves between Pin controls."
      >
        {compareOptimizationTop.map((s, i) => {
          const anchorsPair = compareSuggestionAnchorsSelectedPlanB(s, selectedPlanBNodeId)
          return (
            <li
              key={s.suggestionId}
              data-artifact={ArtifactDomKind.compareSuggestion}
              data-artifact-id={s.suggestionId}
              aria-current={highlightSuggestionId === s.suggestionId ? 'true' : undefined}
              className={`pqat-suggestionItem pqat-suggestionItem--layout${
                highlightSuggestionId === s.suggestionId ? ' pqat-suggestionItem--highlight' : ''
              }`}
            >
              <h3
                className="pqat-suggestionTitle"
                style={{ gridColumn: 1, gridRow: 1, margin: 0 }}
                id={`compare-next-step-title-${s.suggestionId}`}
              >
                {s.title}
              </h3>
              <div style={{ gridColumn: '1 / -1', gridRow: 2 }}>
                <div className="pqat-suggestionMeta pqat-suggestionMeta--readable">
                  <span>{suggestionFamilyLabel(s.suggestionFamily)}</span>
                  <span>{suggestionConfidenceShort(s.confidence)}</span>
                  <span>{suggestionPriorityShort(s.priority)}</span>
                  <span className="pqat-mutedSpan">{optimizationCategoryLabel(s.category)}</span>
                </div>
                {selectedPlanBNodeId ? (
                  <div className="pqat-suggestionMeta" style={{ marginTop: 4 }}>
                    {anchorsPair ? (
                      <span
                        className="pqat-chip pqat-chip--suggestionMeta"
                        aria-label="Suggestion focuses the Plan B node in the selected sidebar pair"
                      >
                        Same pair as sidebar
                      </span>
                    ) : (
                      <span
                        className="pqat-chip pqat-chip--suggestionMeta"
                        style={{ opacity: 0.88 }}
                        aria-label="Suggestion focuses a different Plan B region than the selected pair"
                      >
                        Other region
                      </span>
                    )}
                  </div>
                ) : null}
                <div className="pqat-hint" style={{ marginTop: 4, marginBottom: 0, color: 'var(--text)' }}>
                  {s.summary}
                </div>
                {s.recommendedNextAction ? (
                  <div className="pqat-hint" style={{ marginTop: 6, marginBottom: 0, color: 'var(--text)' }}>
                    <span style={{ fontWeight: 650 }}>Next · </span>
                    {s.recommendedNextAction}
                  </div>
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  {(s.targetNodeIds ?? [])[0] ? (
                    <button
                      type="button"
                      className="pqat-btn pqat-btn--sm pqat-btn--ghost"
                      onMouseEnter={prefetchCompareSelectedPairHeavySections}
                      onFocus={prefetchCompareSelectedPairHeavySections}
                      onClick={() => {
                        const targetB = (s.targetNodeIds ?? [])[0]
                        const m = comparison.matches.find((x) => x.nodeIdB === targetB)
                        if (m) setSelectedPair({ a: m.nodeIdA, b: m.nodeIdB })
                        setHighlightSuggestionId(s.suggestionId)
                        setHighlightFindingDiffId(null)
                        setHighlightIndexInsightDiffId(null)
                      }}
                    >
                      Focus plan B ·{' '}
                      {s.targetDisplayLabel?.trim() ||
                        humanNodeAnchorFromPlan((s.targetNodeIds ?? [])[0], comparison.planB)}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="pqat-btn pqat-btn--sm pqat-btn--ghost"
                    data-testid="compare-suggestion-copy-ticket"
                    aria-label={`Copy compare suggestion for ${s.title}`}
                    onClick={() =>
                      void copyCompareSuggestion.copy(
                        suggestionReferenceText(s, {
                          comparisonId: comparison.comparisonId,
                          pairArtifactId:
                            highlightSuggestionId === s.suggestionId ? selectedPairArtifactId : null,
                          anchorsSelectedPlanBPair: anchorsPair,
                        }),
                        'Copied suggestion',
                      )
                    }
                  >
                    Copy for ticket
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="pqat-btn pqat-btn--sm pqat-btn--ghost pqat-suggestionPinBtn"
                style={{ gridColumn: 2, gridRow: 1, justifySelf: 'end' }}
                ref={(el) => {
                  pinRefs.current[i] = el
                }}
                onKeyDown={(e) => onPinKeyDown(e, i)}
                onClick={() => {
                  setHighlightSuggestionId(s.suggestionId)
                  setHighlightFindingDiffId(null)
                  setHighlightIndexInsightDiffId(null)
                }}
                aria-describedby={`compare-next-step-title-${s.suggestionId}`}
                aria-label={`Pin “${s.title}” for the shared link`}
                title="Pin this suggestion for the shared link"
              >
                Pin
              </button>
            </li>
          )
        })}
      </ul>
      {copyCompareSuggestion.status ? (
        <div
          className="pqat-hint"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ marginTop: 10, marginBottom: 0 }}
        >
          {copyCompareSuggestion.status}
        </div>
      ) : null}
    </>
  )
}
