import { Fragment } from 'react'
import type { AnalyzedPlanNode, PlanComparisonResult } from '../../api/types'
import { resolveFindingDiffPair } from '../../presentation/compareBranchContext'
import { findingAnchorLabel, pairShortLabel } from '../../presentation/nodeLabels'
import { joinSideBadgesForPair } from '../../presentation/joinPainHints'
import type { Badge } from '../../presentation/contextBadges'
import { findingReferenceText, pairReferenceText } from '../../presentation/nodeReferences'
import { relatedIndexDeltaCue } from '../../presentation/compareIndexLinks'
import { ArtifactDomKind } from '../../presentation/artifactLinks'
import type { CompareLeftStackId, CompareWorkspaceLayoutState } from '../../compareWorkspace/compareWorkspaceModel'
import { ClickableRow } from '../ClickableRow'
import { ReferenceCopyButton } from '../ReferenceCopyButton'
import { VirtualizedListColumn } from '../VirtualizedListColumn'
import { prefetchCompareSelectedPairHeavySections } from './prefetchCompareSelectedPairHeavySections'

const FINDINGS_DIFF_VIRTUAL_THRESHOLD = 28

export type CompareNavigatorPanelProps = {
  layout: CompareWorkspaceLayoutState
  comparison: PlanComparisonResult
  byIdA: Map<string, AnalyzedPlanNode>
  byIdB: Map<string, AnalyzedPlanNode>
  filterNodeType: string
  setFilterNodeType: (v: string) => void
  filterFindingChange: string
  setFilterFindingChange: (v: string) => void
  filteredWorsened: PlanComparisonResult['topWorsenedNodes']
  filteredImproved: PlanComparisonResult['topImprovedNodes']
  filteredDiffItems: PlanComparisonResult['findingsDiff']['items']
  unmatchedA: string[]
  unmatchedB: string[]
  pairForDelta: (nodeIdA: string, nodeIdB: string) => import('../../api/types').NodePairDetail | null
  pairSubtitle: (pair: import('../../api/types').NodePairDetail) => string | null
  pairSelected: (nodeIdA: string, nodeIdB: string) => boolean
  setSelectedPair: (p: { a: string; b: string }) => void
  highlightFindingDiffId: string | null
  setHighlightFindingDiffId: (id: string | null) => void
  setHighlightIndexInsightDiffId: (id: string | null) => void
  copyNav: { copy: (text: string, ok: string) => Promise<void>; status: string | null }
  copyFinding: { copy: (text: string, ok: string) => Promise<void>; status: string | null }
}

function joinBadgeClass(tone: Badge['tone']) {
  const base = 'pqat-joinBadge'
  if (tone === 'good') return `${base} pqat-joinBadge--good`
  if (tone === 'bad') return `${base} pqat-joinBadge--bad`
  if (tone === 'mixed') return `${base} pqat-joinBadge--mixed`
  return `${base} pqat-joinBadge--neutral`
}

export function CompareNavigatorPanel(props: CompareNavigatorPanelProps) {
  const {
    layout,
    comparison,
    byIdA,
    byIdB,
    filterNodeType,
    setFilterNodeType,
    filterFindingChange,
    setFilterFindingChange,
    filteredWorsened,
    filteredImproved,
    filteredDiffItems,
    unmatchedA,
    unmatchedB,
    pairForDelta,
    pairSubtitle,
    pairSelected,
    setSelectedPair,
    highlightFindingDiffId,
    setHighlightFindingDiffId,
    setHighlightIndexInsightDiffId,
    copyNav,
    copyFinding,
  } = props

  const vis = layout.visibility
  const showWorsenedImproved = vis.worsenedImproved
  const showFilterRow = showWorsenedImproved

  const leftVisible = layout.leftStackOrder.some((id) => {
    if (id === 'worsenedImproved') return vis.worsenedImproved
    if (id === 'findingsDiff') return vis.findingsDiff
    if (id === 'unmatchedNodes') return vis.unmatchedNodes
    return false
  })

  function renderDeltaCard(
    d: PlanComparisonResult['topWorsenedNodes'][number],
    variant: 'worsened' | 'improved',
  ) {
    const pair = pairForDelta(d.nodeIdA, d.nodeIdB)
    const badges = pair ? joinSideBadgesForPair(pair, byIdA, byIdB, 3) : []
    const indexCue = pair?.indexDeltaCues?.length
    const label = pair ? pairShortLabel(pair, byIdA, byIdB) : `${d.nodeTypeA} → ${d.nodeTypeB}`
    const subtitle = pair ? pairSubtitle(pair) : null
    const aria = variant === 'worsened' ? `Worsened pair: ${label}` : `Improved pair: ${label}`
    return (
      <ClickableRow
        key={`${d.nodeIdA}-${d.nodeIdB}`}
        selected={pairSelected(d.nodeIdA, d.nodeIdB)}
        aria-label={aria}
        onActivate={() => setSelectedPair({ a: d.nodeIdA, b: d.nodeIdB })}
        onPointerIntent={prefetchCompareSelectedPairHeavySections}
        className="pqat-navPairRow"
      >
        <div className="pqat-navPairRow__top">
          <div className="pqat-navPairRow__main">
            <div className="pqat-navPairRow__titleLine">
              <div className="pqat-navPairRow__label">{label}</div>
              {indexCue ? <span className="pqat-chipIndexDelta">index Δ</span> : null}
            </div>
            {subtitle ? <div className="pqat-navPairRow__subtitle">{subtitle}</div> : null}
          </div>
          {pair ? (
            <ReferenceCopyButton
              aria-label="Copy pair reference"
              onCopy={() =>
                copyNav.copy(pairReferenceText(pair, byIdA, byIdB, { comparisonId: comparison.comparisonId }), 'Copied pair reference')
              }
            />
          ) : null}
        </div>
        <div className="pqat-navPairRow__stats">
          <div className="pqat-monoMuted">
            conf {d.matchConfidence} · score {Number(d.matchScore).toFixed(2)}
          </div>
          <div className="pqat-monoMuted">
            inclusiveΔ {String(d.inclusiveTimeMs?.delta)}ms · readsΔ {String(d.sharedReadBlocks?.delta)}
          </div>
        </div>
        {badges.length ? (
          <div className="pqat-navPairRow__badges">
            {badges.map((b) => (
              <span key={b.text} className={joinBadgeClass(b.tone)}>
                {b.text}
              </span>
            ))}
          </div>
        ) : null}
      </ClickableRow>
    )
  }

  function stackBlock(id: CompareLeftStackId) {
    if (id === 'worsenedImproved' && vis.worsenedImproved) {
      return (
        <>
          <div>
            <div className="pqat-blockHeader">
              <div className="pqat-blockTitle">Worsened</div>
              <div className="pqat-monoMuted">{filteredWorsened.length} shown</div>
            </div>
            <div className="pqat-stackList">{filteredWorsened.slice(0, 8).map((d) => renderDeltaCard(d, 'worsened'))}</div>
          </div>

          <div>
            <div className="pqat-blockHeader">
              <div className="pqat-blockTitle">Improved</div>
              <div className="pqat-monoMuted">{filteredImproved.length} shown</div>
            </div>
            <div className="pqat-stackList">{filteredImproved.slice(0, 8).map((d) => renderDeltaCard(d, 'improved'))}</div>
          </div>
        </>
      )
    }
    if (id === 'findingsDiff' && vis.findingsDiff) {
      return (
        <div>
          <h2 className="pqat-sectionTitle">Findings diff</h2>
          <div className="pqat-filterBar pqat-filterBar--tight">
            <select
              className="pqat-select pqat-filterSelect"
              value={filterFindingChange}
              onChange={(e) => setFilterFindingChange(e.target.value)}
            >
              <option value="">all</option>
              <option value="New">New</option>
              <option value="Resolved">Resolved</option>
              <option value="Worsened">Worsened</option>
              <option value="Improved">Improved</option>
              <option value="Unchanged">Unchanged</option>
            </select>
          </div>
          {filteredDiffItems.length >= FINDINGS_DIFF_VIRTUAL_THRESHOLD ? (
            <VirtualizedListColumn
              count={filteredDiffItems.length}
              estimateSize={156}
              maxHeight="min(480px, 52vh)"
              className="pqat-findingsDiffList"
              aria-label="Findings diff (scroll for more)"
            >
              {(rowIdx) => {
                const i = filteredDiffItems[rowIdx]!
                const relIdx = i.relatedIndexDiffIndexes ?? []
                const relIds = i.relatedIndexDiffIds ?? []
                const rowHighlighted = Boolean(i.diffId) && highlightFindingDiffId === i.diffId
                return (
                  <div
                    key={i.diffId || `${i.ruleId}-${rowIdx}`}
                    data-artifact={i.diffId ? ArtifactDomKind.findingDiff : undefined}
                    data-artifact-id={i.diffId || undefined}
                    className={`pqat-artifactOutline${rowHighlighted ? ' pqat-artifactOutline--active' : ''}`}
                  >
                    <ClickableRow
                      selected={(() => {
                        const r = resolveFindingDiffPair(i, comparison.matches)
                        return r ? pairSelected(r.a, r.b) : false
                      })()}
                      aria-label={`Finding diff: ${i.ruleId}`}
                      onActivate={() => {
                        const r = resolveFindingDiffPair(i, comparison.matches)
                        if (r) setSelectedPair(r)
                        if (i.diffId) setHighlightFindingDiffId(i.diffId)
                      }}
                      onPointerIntent={prefetchCompareSelectedPairHeavySections}
                      className="pqat-findingsDiffRow"
                    >
                      <div className="pqat-findingsDiffMeta">
                        {i.changeType} · {i.ruleId} · {String(i.severityA)} → {String(i.severityB)}
                      </div>
                      <div className="pqat-findingsDiffAnchorRow">
                        <div className="pqat-hint" style={{ fontSize: '0.8125rem', margin: 0 }}>
                          {findingAnchorLabel(i.nodeIdB ?? i.nodeIdA, i.nodeIdB ? byIdB : byIdA)}
                        </div>
                        <ReferenceCopyButton
                          aria-label="Copy finding reference"
                          onCopy={() => {
                            const nid = i.nodeIdB ?? i.nodeIdA
                            if (!nid) return
                            copyFinding.copy(
                              findingReferenceText(nid, i.nodeIdB ? byIdB : byIdA, `${i.changeType} finding: ${i.ruleId}`),
                              'Copied finding reference',
                            )
                          }}
                        />
                      </div>
                      <div className="pqat-findingsDiffSummary">{i.summary}</div>
                      {relIds.length || relIdx.length ? (
                        <div className="pqat-indexLinkRow">
                          <span className="pqat-monoMuted">Related index change</span>
                          <span className="pqat-mutedSpan">{relatedIndexDeltaCue(relIds.length || relIdx.length)}</span>
                          {relIds.map((rid) => (
                            <button
                              key={rid}
                              type="button"
                              className="pqat-pillLinkBtn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setHighlightIndexInsightDiffId(rid)
                                setHighlightFindingDiffId(null)
                              }}
                            >
                              {rid.length > 14 ? `${rid.slice(0, 12)}…` : rid}
                            </button>
                          ))}
                          {relIdx.map((ix) => (
                            <button
                              key={`ix-${ix}`}
                              type="button"
                              className="pqat-pillLinkBtn"
                              onClick={(e) => {
                                e.stopPropagation()
                                const insightId = comparison.indexComparison?.insightDiffs[ix]?.insightDiffId
                                if (insightId) setHighlightIndexInsightDiffId(insightId)
                                setHighlightFindingDiffId(null)
                              }}
                            >
                              Index Δ #{ix}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </ClickableRow>
                  </div>
                )
              }}
            </VirtualizedListColumn>
          ) : (
            <div className="pqat-findingsDiffList">
              {filteredDiffItems.map((i, idx) => {
                const relIdx = i.relatedIndexDiffIndexes ?? []
                const relIds = i.relatedIndexDiffIds ?? []
                const rowHighlighted = Boolean(i.diffId) && highlightFindingDiffId === i.diffId
                return (
                  <div
                    key={i.diffId || `${i.ruleId}-${idx}`}
                    data-artifact={i.diffId ? ArtifactDomKind.findingDiff : undefined}
                    data-artifact-id={i.diffId || undefined}
                    className={`pqat-artifactOutline${rowHighlighted ? ' pqat-artifactOutline--active' : ''}`}
                  >
                    <ClickableRow
                      selected={(() => {
                        const r = resolveFindingDiffPair(i, comparison.matches)
                        return r ? pairSelected(r.a, r.b) : false
                      })()}
                      aria-label={`Finding diff: ${i.ruleId}`}
                      onActivate={() => {
                        const r = resolveFindingDiffPair(i, comparison.matches)
                        if (r) setSelectedPair(r)
                        if (i.diffId) setHighlightFindingDiffId(i.diffId)
                      }}
                      onPointerIntent={prefetchCompareSelectedPairHeavySections}
                      className="pqat-findingsDiffRow"
                    >
                      <div className="pqat-findingsDiffMeta">
                        {i.changeType} · {i.ruleId} · {String(i.severityA)} → {String(i.severityB)}
                      </div>
                      <div className="pqat-findingsDiffAnchorRow">
                        <div className="pqat-hint" style={{ fontSize: '0.8125rem', margin: 0 }}>
                          {findingAnchorLabel(i.nodeIdB ?? i.nodeIdA, i.nodeIdB ? byIdB : byIdA)}
                        </div>
                        <ReferenceCopyButton
                          aria-label="Copy finding reference"
                          onCopy={() => {
                            const nid = i.nodeIdB ?? i.nodeIdA
                            if (!nid) return
                            copyFinding.copy(
                              findingReferenceText(nid, i.nodeIdB ? byIdB : byIdA, `${i.changeType} finding: ${i.ruleId}`),
                              'Copied finding reference',
                            )
                          }}
                        />
                      </div>
                      <div className="pqat-findingsDiffSummary">{i.summary}</div>
                      {relIds.length || relIdx.length ? (
                        <div className="pqat-indexLinkRow">
                          <span className="pqat-monoMuted">Related index change</span>
                          <span className="pqat-mutedSpan">{relatedIndexDeltaCue(relIds.length || relIdx.length)}</span>
                          {relIds.map((rid) => (
                            <button
                              key={rid}
                              type="button"
                              className="pqat-pillLinkBtn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setHighlightIndexInsightDiffId(rid)
                                setHighlightFindingDiffId(null)
                              }}
                            >
                              {rid.length > 14 ? `${rid.slice(0, 12)}…` : rid}
                            </button>
                          ))}
                          {relIdx.map((ix) => (
                            <button
                              key={`ix-${ix}`}
                              type="button"
                              className="pqat-pillLinkBtn"
                              onClick={(e) => {
                                e.stopPropagation()
                                const insightId = comparison.indexComparison?.insightDiffs[ix]?.insightDiffId
                                if (insightId) setHighlightIndexInsightDiffId(insightId)
                                setHighlightFindingDiffId(null)
                              }}
                            >
                              Index Δ #{ix}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </ClickableRow>
                  </div>
                )
              })}
            </div>
          )}
          {copyFinding.status ? (
            <div className="pqat-copyStatus" role="status" aria-live="polite" aria-atomic="true">
              {copyFinding.status}
            </div>
          ) : null}
        </div>
      )
    }
    if (id === 'unmatchedNodes' && vis.unmatchedNodes) {
      return (
        <details className="pqat-details pqat-details--muted">
          <summary>Unmatched nodes</summary>
          <div className="pqat-detailsBody">
            <div className="pqat-monoLine">
              A-only: {unmatchedA.length} · B-only: {unmatchedB.length}
            </div>
            <div className="pqat-unmatchedGrid">
              <div>
                <b>A-only</b>
                <ul className="pqat-unmatchedList">
                  {unmatchedA.slice(0, 60).map((nid) => (
                    <li key={nid}>{findingAnchorLabel(nid, byIdA)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <b>B-only</b>
                <ul className="pqat-unmatchedList">
                  {unmatchedB.slice(0, 60).map((nid) => (
                    <li key={nid}>{findingAnchorLabel(nid, byIdB)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </details>
      )
    }
    return null
  }

  if (!leftVisible) {
    return (
      <div className="pqat-panel pqat-panel--tool pqat-hint pqat-panelPad--sm pqat-panelHintDense">
        All navigator list panels are hidden. Use <b>Customize workspace</b> to show worsened/improved, findings diff, or unmatched nodes.
      </div>
    )
  }

  return (
    <div className="pqat-panel pqat-panel--detail pqat-panelPad--md" aria-label="Compare navigator">
      {copyNav.status ? (
        <div className="pqat-hint" role="status" aria-live="polite" aria-atomic="true" style={{ marginBottom: 10 }}>
          {copyNav.status}
        </div>
      ) : null}
      {showFilterRow ? (
        <div className="pqat-filterBar">
          <input
            className="pqat-input pqat-filterBar__input"
            value={filterNodeType}
            onChange={(e) => setFilterNodeType(e.target.value)}
            placeholder="Filter by node type"
          />
          <button
            type="button"
            className="pqat-btn pqat-btn--sm"
            onClick={() => {
              const first = filteredWorsened[0] ?? filteredImproved[0]
              if (first) setSelectedPair({ a: first.nodeIdA, b: first.nodeIdB })
            }}
          >
            jump to hottest
          </button>
        </div>
      ) : null}

      <div className="pqat-eyebrow">Lists</div>
      <h2 className="pqat-sectionTitle">Navigator</h2>
      <div className="pqat-navigatorStack">
        {layout.leftStackOrder.map((lid) => (
          <Fragment key={lid}>{stackBlock(lid)}</Fragment>
        ))}
      </div>
    </div>
  )
}
