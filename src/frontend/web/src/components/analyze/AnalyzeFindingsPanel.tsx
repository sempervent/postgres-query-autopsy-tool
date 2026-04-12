import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { AnalysisFinding, AnalyzedPlanNode } from '../../api/types'
import { findingAnchorLabel } from '../../presentation/nodeLabels'
import { joinSideContextLineForNode } from '../../presentation/joinPainHints'
import { findingReferenceText } from '../../presentation/nodeReferences'
import { scrollIntoViewOptionsForUser } from '../../presentation/motionPreferences'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'
import { ClickableRow } from '../ClickableRow'
import { ReferenceCopyButton } from '../ReferenceCopyButton'
import { VirtualizedListColumn, VIRTUAL_LIST_THRESHOLD, type VirtualizedListColumnHandle } from '../VirtualizedListColumn'
import { findingConfidenceLabel, severityChipClass, severityLabel } from '../../presentation/localEvidencePresentation'
import { queryRankedFindingRow } from '../../presentation/analyzeEvidenceDom'
import {
  ANALYZE_RANKED_BAND_RESTORED_HINT,
  analyzeRankedPivotThreadLabel,
  type AnalyzeRankedHandoffOrigin,
} from '../../presentation/analyzeRankedContinuityCopy'
import { ANALYZE_RANKED_FINDINGS_ANCHOR_ID, ANALYZE_RANKED_FINDINGS_HEADING_ID } from './SkipToRankedFindingsLink'

export function AnalyzeFindingsPanel(props: {
  findingSearch: string
  setFindingSearch: (v: string) => void
  minSeverity: number
  setMinSeverity: (v: number) => void
  filteredFindings: AnalysisFinding[]
  selectedNodeId: string | null
  /** Matches summary “Start here” when the takeaway is finding-driven (Phase 108 cascade). */
  primaryTriageFindingId?: string | null
  /** After explicit open from plan band / detail — scroll + brief row emphasis. */
  graphPivotFindingId?: string | null
  jumpToNodeId: (id: string) => void
  byId: Map<string, AnalyzedPlanNode>
  copyFinding: ReturnType<typeof useCopyFeedback>
  analysisId?: string | null
  /** Saved `?analysis=` load vs run from plan text in this tab (Phase 134). */
  rankedHandoffOrigin?: AnalyzeRankedHandoffOrigin
  /** Fires once when the graph-pivot row receives real focus after open-from-plan (Phase 128). */
  onGraphPivotFocusArrived?: () => void
}) {
  const {
    findingSearch,
    setFindingSearch,
    minSeverity,
    setMinSeverity,
    filteredFindings,
    selectedNodeId,
    primaryTriageFindingId,
    graphPivotFindingId,
    jumpToNodeId,
    byId,
    copyFinding,
    analysisId,
    rankedHandoffOrigin = 'session',
    onGraphPivotFocusArrived,
  } = props

  const rankedArrivalCueId = useId()
  const rankedContinuityId = useId()
  const rankedRestoredBandHintId = useId()
  const [showRankedArrivalCue, setShowRankedArrivalCue] = useState(false)
  const rankedArrivalCueTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)

  const signalRankedArrivalFromPlan = useCallback(() => {
    onGraphPivotFocusArrived?.()
    setShowRankedArrivalCue(true)
    if (rankedArrivalCueTimerRef.current != null) {
      window.clearTimeout(rankedArrivalCueTimerRef.current)
    }
    rankedArrivalCueTimerRef.current = window.setTimeout(() => {
      setShowRankedArrivalCue(false)
      rankedArrivalCueTimerRef.current = null
    }, 2800)
  }, [onGraphPivotFocusArrived])

  useEffect(() => {
    return () => {
      if (rankedArrivalCueTimerRef.current != null) window.clearTimeout(rankedArrivalCueTimerRef.current)
    }
  }, [])

  const useVirtual = filteredFindings.length >= VIRTUAL_LIST_THRESHOLD
  const virtualListRef = useRef<VirtualizedListColumnHandle>(null)

  const filteredFindingIdsKey = filteredFindings.map((f) => f.findingId).join('\n')

  function scrollFindingRowIntoView(findingId: string, onAfterScroll?: () => void) {
    const id = window.requestAnimationFrame(() => {
      if (useVirtual) {
        const idx = filteredFindings.findIndex((f) => f.findingId === findingId)
        if (idx >= 0) {
          virtualListRef.current?.scrollToIndex(idx, { align: 'center' }, onAfterScroll)
          return
        }
        onAfterScroll?.()
        return
      }
      const root = document.getElementById(ANALYZE_RANKED_FINDINGS_ANCHOR_ID)
      if (!root) {
        onAfterScroll?.()
        return
      }
      const el = queryRankedFindingRow(root, findingId)
      if (el instanceof HTMLElement && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView(scrollIntoViewOptionsForUser({ block: 'center', inline: 'nearest' }))
      }
      onAfterScroll?.()
    })
    return () => window.cancelAnimationFrame(id)
  }

  useEffect(() => {
    if (!primaryTriageFindingId) return
    if (!filteredFindings.some((f) => f.findingId === primaryTriageFindingId)) return
    return scrollFindingRowIntoView(primaryTriageFindingId)
  }, [primaryTriageFindingId, filteredFindingIdsKey, useVirtual])

  useEffect(() => {
    if (!graphPivotFindingId) return
    if (!filteredFindings.some((f) => f.findingId === graphPivotFindingId)) return
    const fid = graphPivotFindingId
    let cancelled = false

    const tryFocusPivot = (): boolean => {
      const root = document.getElementById(ANALYZE_RANKED_FINDINGS_ANCHOR_ID)
      if (!root) return false
      const row = queryRankedFindingRow(root, fid)
      if (!row) return false
      row.focus({ preventScroll: true })
      return document.activeElement === row
    }

    /** Short rAF chain if the row mounts a frame late (virtual measurement, layout). */
    const focusWithRafRetries = (remaining: number) => {
      if (cancelled) return
      if (tryFocusPivot()) {
        signalRankedArrivalFromPlan()
        return
      }
      if (remaining <= 0) return
      requestAnimationFrame(() => focusWithRafRetries(remaining - 1))
    }

    const cleanupScroll = scrollFindingRowIntoView(fid, () => {
      if (cancelled) return
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          if (tryFocusPivot()) {
            signalRankedArrivalFromPlan()
            return
          }
          focusWithRafRetries(useVirtual ? 14 : 8)
        })
      })
    })

    return () => {
      cancelled = true
      cleanupScroll()
    }
  }, [graphPivotFindingId, filteredFindingIdsKey, useVirtual, signalRankedArrivalFromPlan])

  function renderFindingRow(f: AnalysisFinding) {
    const anchorId = (f.nodeIds ?? [])[0]
    const triagePrimary = Boolean(primaryTriageFindingId && f.findingId === primaryTriageFindingId)
    const graphPivot = Boolean(graphPivotFindingId && f.findingId === graphPivotFindingId)
    return (
      <ClickableRow
        key={f.findingId}
        className={`pqat-listRow${triagePrimary ? ' pqat-listRow--triagePrimary' : ''}${graphPivot ? ' pqat-listRow--graphPivot' : ''}`}
        selectedEmphasis="accent-bar"
        selected={!!anchorId && anchorId === selectedNodeId}
        data-finding-id={f.findingId}
        aria-label={graphPivot ? `Finding: ${f.title}. Continues from plan.` : `Finding: ${f.title}`}
        onActivate={() => {
          const target = anchorId
          if (target) jumpToNodeId(target)
        }}
        style={{
          padding: 12,
          color: 'var(--text-h)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {triagePrimary ? <div className="pqat-triagePrimaryCue">Matches summary</div> : null}
            <span style={{ fontFamily: 'var(--mono)' }}>{findingAnchorLabel(anchorId, byId as any)}</span>
          </div>
          <ReferenceCopyButton
            aria-label="Copy finding reference"
            onCopy={() => {
              if (!anchorId) return
              copyFinding.copy(
                findingReferenceText(anchorId, byId, f.title, analysisId ? { analysisId } : undefined),
                'Copied finding reference',
              )
            }}
          />
        </div>
        {(() => {
          if (!anchorId) return null
          const n = byId.get(anchorId) ?? null
          const side = joinSideContextLineForNode(n)
          if (!side) return null
          return <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{side}</div>
        })()}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span className={severityChipClass(f.severity)}>{severityLabel(f.severity)}</span>
            <span style={{ fontWeight: 750, fontSize: '0.9375rem', lineHeight: 1.35 }}>{f.title}</span>
          </div>
          <span className="pqat-chip">{findingConfidenceLabel(f.confidence)}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
          rule: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>{f.ruleId}</span> · category:{' '}
          {String(f.category)}
        </div>
        <div style={{ marginTop: 8, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text)' }}>{f.summary}</div>
        <details className="pqat-details" style={{ marginTop: 10 }}>
          <summary>Evidence + explanation</summary>
          <div style={{ marginTop: 8, fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{f.explanation}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--text-h)' }}>Suggestion:</b> {f.suggestion}
          </div>
        </details>
      </ClickableRow>
    )
  }

  /** Arrival status sits below the heading; thread hint is on the region’s aria-describedby when pivoting (Phase 133). */
  const headingDescribedBy = showRankedArrivalCue ? rankedArrivalCueId : undefined

  const showPivotContinuity = Boolean(graphPivotFindingId)
  const showRankedRestoredBandHint = rankedHandoffOrigin === 'link' && !showPivotContinuity
  const rankedRootDescribedBy = showRankedRestoredBandHint ? rankedRestoredBandHintId : undefined

  return (
    <div
      id={ANALYZE_RANKED_FINDINGS_ANCHOR_ID}
      className={`pqat-panel pqat-panel--detail pqat-rankedFindingsPanel${showRankedArrivalCue ? ' pqat-rankedFindingsPanel--arrivalCue' : ''}${showPivotContinuity ? ' pqat-rankedFindingsPanel--pivotContinuity' : ''}`}
      style={{ minWidth: 0, padding: '16px 18px' }}
      aria-labelledby={ANALYZE_RANKED_FINDINGS_HEADING_ID}
      aria-describedby={rankedRootDescribedBy}
      tabIndex={-1}
    >
      {showPivotContinuity ? (
        <div
          data-testid="analyze-visual-ranked-continuation-contract"
          className="pqat-rankedContinuationContract"
          role="region"
          aria-labelledby={ANALYZE_RANKED_FINDINGS_HEADING_ID}
          aria-describedby={rankedContinuityId}
        >
          <div className="pqat-rankedFindingsPanel__head">
            <div className="pqat-eyebrow">Ranked</div>
            <span
              className="pqat-rankedThreadHint"
              id={rankedContinuityId}
              data-testid="analyze-ranked-handoff-hint"
              data-pqat-ranked-handoff-origin={rankedHandoffOrigin}
            >
              {analyzeRankedPivotThreadLabel(rankedHandoffOrigin)}
            </span>
          </div>
          <h2 id={ANALYZE_RANKED_FINDINGS_HEADING_ID} aria-describedby={headingDescribedBy}>
            Findings
          </h2>
        </div>
      ) : (
        <>
          <div className="pqat-rankedFindingsPanel__head">
            <div className="pqat-eyebrow">Ranked</div>
            {showRankedRestoredBandHint ? (
              <span
                id={rankedRestoredBandHintId}
                className="pqat-rankedThreadHint"
                data-testid="analyze-ranked-restored-hint"
                data-pqat-ranked-handoff-origin="link"
              >
                {ANALYZE_RANKED_BAND_RESTORED_HINT}
              </span>
            ) : null}
          </div>
          <h2 id={ANALYZE_RANKED_FINDINGS_HEADING_ID} aria-describedby={headingDescribedBy}>
            Findings
          </h2>
        </>
      )}
      {showRankedArrivalCue ? (
        <div
          id={rankedArrivalCueId}
          className="pqat-rankedArrivalCue"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          On the matching row — full write-up below.
        </div>
      ) : null}
      <p className="pqat-hint" style={{ marginBottom: 8 }}>
        Row selects the operator. Plan band shows <strong>previews</strong>; <strong>Open in ranked list</strong> is the full write-up.
      </p>
      <details className="pqat-details pqat-details--muted" style={{ marginBottom: 12 }}>
        <summary>Rule letter reference</summary>
        <p className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
          J/F indexing, R index-heavy paths, S bitmap recheck, P chunk+bitmap, Q nested-loop, L hash join, M materialize, K sort — see catalog in docs.
        </p>
      </details>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <input
          className="pqat-input"
          value={findingSearch}
          onChange={(e) => setFindingSearch(e.target.value)}
          placeholder="Search findings (title/summary/rule)"
          style={{ flex: 1 }}
        />
        <select
          className="pqat-select"
          value={minSeverity}
          onChange={(e) => setMinSeverity(Number(e.target.value))}
          style={{ width: 'auto', minWidth: 120 }}
        >
          <option value={0}>Info+</option>
          <option value={1}>Low+</option>
          <option value={2}>Medium+</option>
          <option value={3}>High+</option>
          <option value={4}>Critical only</option>
        </select>
      </div>

      {useVirtual ? (
        <VirtualizedListColumn
          ref={virtualListRef}
          count={filteredFindings.length}
          estimateSize={200}
          aria-label="Findings list (scroll for more)"
        >
          {(i) => renderFindingRow(filteredFindings[i]!)}
        </VirtualizedListColumn>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{filteredFindings.map((f) => renderFindingRow(f))}</div>
      )}
      {useVirtual ? (
        <p className="pqat-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Showing {filteredFindings.length} findings in a scrollable window for responsiveness.
        </p>
      ) : null}
      {copyFinding.status ? (
        <div className="pqat-hint" role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: 10 }}>
          {copyFinding.status}
        </div>
      ) : null}
    </div>
  )
}
