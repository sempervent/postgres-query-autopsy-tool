import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { PlanComparisonResult } from '../../api/types'
import { relatedFindingChangesCue } from '../../presentation/compareIndexLinks'
import type { CompareIndexSectionModel } from '../../presentation/comparePresentation'
import { ArtifactDomKind } from '../../presentation/artifactLinks'
import { nextRovingOrdinal } from '../../presentation/comparePinning'

export type CompareIndexInsightRowsProps = {
  indexSection: CompareIndexSectionModel
  comparison: PlanComparisonResult
  highlightIndexInsightDiffId: string | null
  setHighlightFindingDiffId: (id: string | null) => void
  setHighlightIndexInsightDiffId: (id: string | null) => void
  setHighlightSuggestionId: (id: string | null) => void
}

export function CompareIndexInsightRows(props: CompareIndexInsightRowsProps) {
  const {
    indexSection,
    comparison,
    highlightIndexInsightDiffId,
    setHighlightFindingDiffId,
    setHighlightIndexInsightDiffId,
    setHighlightSuggestionId,
  } = props

  const rows = indexSection.topInsightDiffs
  const n = rows.length

  const [focusOrdinal, setFocusOrdinal] = useState(0)

  useEffect(() => {
    if (n === 0) return
    const hi = highlightIndexInsightDiffId
    if (!hi) return
    const rowIdx = rows.findIndex((r) => r.insightDiffId === hi)
    if (rowIdx < 0) return
    setFocusOrdinal(rowIdx)
    const id = requestAnimationFrame(() => {
      liRefs.current[rowIdx]?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [highlightIndexInsightDiffId, rows, n])

  const pinIndexInsightRow = (insightId: string) => {
    setHighlightIndexInsightDiffId(insightId)
    setHighlightFindingDiffId(null)
    setHighlightSuggestionId(null)
  }

  const liRefs = useRef<(HTMLLIElement | null)[]>([])
  useEffect(() => {
    liRefs.current = liRefs.current.slice(0, rows.length)
  }, [rows.length])

  const moveRoving = (delta: number) => {
    if (n <= 0) return
    const next = nextRovingOrdinal(focusOrdinal, delta, n)
    setFocusOrdinal(next)
    requestAnimationFrame(() => liRefs.current[next]?.focus())
  }

  return (
    <ul
      className="pqat-bulletList pqat-indexInsightRovingList"
      aria-label="Index insight diffs — Arrow Up or Down moves between rows; Enter or Space pins the row for Copy link."
    >
      {rows.map((row, i) => {
        const rowHighlighted = highlightIndexInsightDiffId === row.insightDiffId
        const id = row.insightDiffId
        const rovingHere = i === focusOrdinal
        const tabIdx = rovingHere ? 0 : -1

        const onInsightKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            moveRoving(1)
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            moveRoving(-1)
            return
          }
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          pinIndexInsightRow(id)
        }

        return (
          <li
            key={`${row.diffIndex}-${row.kindLabel}-${row.summary.slice(0, 40)}`}
            ref={(el) => {
              liRefs.current[i] = el
            }}
            data-artifact={ArtifactDomKind.indexInsightDiff}
            data-artifact-id={id}
            tabIndex={tabIdx}
            aria-current={rowHighlighted ? 'true' : undefined}
            aria-label={`Index change: ${row.kindLabel}. Activate to pin this index insight for Copy link.`}
            className={`pqat-indexInsightItem pqat-indexInsightItem--interactive${
              rowHighlighted ? ' pqat-indexInsightItem--active' : ''
            }`}
            onClick={() => pinIndexInsightRow(id)}
            onKeyDown={onInsightKeyDown}
          >
            <span className="pqat-inlineMeta">{row.kindLabel} · </span>
            {row.summary}
            {row.relatedFindingHints.length ? (
              <div className="pqat-suggestionMeta" style={{ marginTop: 4 }}>
                <span>{relatedFindingChangesCue(row.relatedFindingIndexes.length)}</span>
                <span className="pqat-mutedSpan">({row.relatedFindingHints.join(' · ')})</span>
                {row.relatedFindingDiffIds[0] ? (
                  <button
                    type="button"
                    className="pqat-pillLinkBtn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setHighlightFindingDiffId(row.relatedFindingDiffIds[0]!)
                      setHighlightIndexInsightDiffId(null)
                      setHighlightSuggestionId(null)
                    }}
                  >
                    Highlight finding
                  </button>
                ) : row.relatedFindingIndexes[0] != null ? (
                  <button
                    type="button"
                    className="pqat-pillLinkBtn"
                    onClick={(e) => {
                      e.stopPropagation()
                      const item = comparison.findingsDiff.items[row.relatedFindingIndexes[0]!]
                      if (item?.diffId) setHighlightFindingDiffId(item.diffId)
                      setHighlightIndexInsightDiffId(null)
                      setHighlightSuggestionId(null)
                    }}
                  >
                    Highlight finding
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
