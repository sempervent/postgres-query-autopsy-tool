import type { AppConfig, OptimizationSuggestion, PlanComparisonResult } from '../../api/types'
import { relatedFindingChangesCue } from '../../presentation/compareIndexLinks'
import type { CompareIndexSectionModel } from '../../presentation/comparePresentation'
import {
  compareSuggestionAnchorsSelectedPlanB,
  optimizationCategoryLabel,
  suggestionConfidenceShort,
  suggestionFamilyLabel,
  suggestionPriorityShort,
  suggestionReferenceText,
} from '../../presentation/optimizationSuggestionsPresentation'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'
import { ArtifactDomKind } from '../../presentation/artifactLinks'
import type { CompareSummarySectionId, CompareWorkspaceLayoutState } from '../../compareWorkspace/compareWorkspaceModel'
import { ArtifactSharingPanel } from '../ArtifactSharingPanel'
import { CompareCaptureContextColumn } from './CompareCaptureContextColumn'
import { prefetchCompareSelectedPairHeavySections } from './prefetchCompareSelectedPairHeavySections'
import { humanNodeAnchorFromPlan, normalizeComparisonStoryBeat } from '../../presentation/planReferencePresentation'
import { comparisonStorySectionLabels } from '../../presentation/storyPresentation'

export type CompareSummaryColumnProps = {
  layout: CompareWorkspaceLayoutState
  comparison: PlanComparisonResult
  /** Phase 69: compact continuity chip (selected pair or primary story beat). */
  continuitySummaryCue?: string | null
  appConfig: AppConfig | null
  coverage: string | null
  summaryCards: { key: string; label: string; value: string; deltaLabel?: string | null; tone?: 'good' | 'bad' | 'neutral' }[]
  indexSection: CompareIndexSectionModel | null
  compareOptimizationTop: OptimizationSuggestion[]
  findingsNewCount: number
  findingsResolvedCount: number
  highlightIndexInsightDiffId: string | null
  highlightSuggestionId: string | null
  /** When the pinned suggestion matches the selected pair, include pair artifact id in copy payload. */
  selectedPairArtifactId: string | null
  /** Plan B node id of sidebar pair — scopes suggestion chips and copy payloads. */
  selectedPlanBNodeId: string | null
  setHighlightFindingDiffId: (id: string | null) => void
  setHighlightIndexInsightDiffId: (id: string | null) => void
  setHighlightSuggestionId: (id: string | null) => void
  setSelectedPair: (p: { a: string; b: string }) => void
  copyShareCompare: { copy: (text: string, toast: string) => Promise<void>; status: string | null }
  copyCompareSuggestion: ReturnType<typeof useCopyFeedback>
  shareCompareUi: { label: string; toast: string }
  onSharingSaved: () => Promise<void>
}

function metricToneClass(tone: 'good' | 'bad' | 'neutral' | undefined) {
  if (tone === 'good') return 'pqat-metricTile pqat-metricTile--toneGood'
  if (tone === 'bad') return 'pqat-metricTile pqat-metricTile--toneBad'
  return 'pqat-metricTile'
}

export function CompareSummaryColumn(props: CompareSummaryColumnProps) {
  const {
    layout,
    comparison,
    continuitySummaryCue,
    appConfig,
    coverage,
    summaryCards,
    indexSection,
    compareOptimizationTop,
    findingsNewCount,
    findingsResolvedCount,
    highlightIndexInsightDiffId,
    highlightSuggestionId,
    selectedPairArtifactId,
    selectedPlanBNodeId,
    setHighlightFindingDiffId,
    setHighlightIndexInsightDiffId,
    setHighlightSuggestionId,
    setSelectedPair,
    copyShareCompare,
    copyCompareSuggestion,
    shareCompareUi,
    onSharingSaved,
  } = props

  const vis = layout.visibility
  const hasAny = layout.summarySectionOrder.some((sid) => vis[sid])

  function section(sid: CompareSummarySectionId) {
    if (!vis[sid]) return null
    switch (sid) {
      case 'summaryCards':
        return (
          <>
            <div className="pqat-summaryMetaLine">
              ComparisonId {comparison.comparisonId} · stored in server SQLite (survives restart if the DB file is kept)
              {appConfig?.authEnabled
                ? ' · in auth mode, opening may require identity; link access depends on sharing settings.'
                : ''}
            </div>
            <ArtifactSharingPanel
              authEnabled={appConfig?.authEnabled ?? false}
              authIdentityKind={appConfig?.authIdentityKind}
              authHelp={appConfig?.authHelp}
              kind="comparison"
              artifactId={comparison.comparisonId}
              artifactAccess={comparison.artifactAccess}
              onSaved={onSharingSaved}
            />
            <div className="pqat-metricGrid">
              {summaryCards.map((c) => (
                <div key={c.key} className={metricToneClass(c.tone)}>
                  <div className="pqat-metricTile__label">{c.label}</div>
                  <div className="pqat-metricTile__value">{c.value}</div>
                  {c.deltaLabel ? <div className="pqat-metricTile__delta">{c.deltaLabel}</div> : null}
                </div>
              ))}
            </div>
          </>
        )
      case 'summaryCaptureContext':
        return (
          <details
            className="pqat-details pqat-details--muted pqat-details--meta"
            style={{ marginTop: 12 }}
            aria-label="Plan capture and EXPLAIN context"
          >
            <summary>Plan capture / EXPLAIN context (A vs B)</summary>
            <div className="pqat-detailsBody pqat-formGrid2 pqat-formGrid2--tight">
              <CompareCaptureContextColumn title="Plan A (baseline)" plan={comparison.planA} />
              <CompareCaptureContextColumn title="Plan B (changed)" plan={comparison.planB} />
            </div>
          </details>
        )
      case 'summaryIndexChanges':
        if (!indexSection || (indexSection.overviewLines.length === 0 && indexSection.topInsightDiffs.length === 0)) return null
        return (
          <div className="pqat-callout pqat-callout--accent">
            <div className="pqat-callout__title">Index changes</div>
            {indexSection.headlineResolved ? (
              <div className="pqat-hint" style={{ fontSize: '0.8125rem', marginBottom: 6, color: 'var(--text)' }}>
                <span className="pqat-inlineMeta">Resolved highlight · </span>
                {indexSection.headlineResolved}
              </div>
            ) : null}
            {indexSection.headlineNew ? (
              <div className="pqat-hint" style={{ fontSize: '0.8125rem', marginBottom: 6, color: 'var(--text)' }}>
                <span className="pqat-inlineMeta">New highlight · </span>
                {indexSection.headlineNew}
              </div>
            ) : null}
            {indexSection.overviewLines.length ? (
              <ul className="pqat-bulletList pqat-bulletList--tight">
                {indexSection.overviewLines.slice(0, 5).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {indexSection.topInsightDiffs.length ? (
              <ul className="pqat-bulletList">
                {indexSection.topInsightDiffs.map((row) => {
                  const rowHighlighted = Boolean(row.insightDiffId) && highlightIndexInsightDiffId === row.insightDiffId
                  const id = row.insightDiffId || null
                  return (
                    <li
                      key={`${row.diffIndex}-${row.kindLabel}-${row.summary.slice(0, 40)}`}
                      data-artifact={id ? ArtifactDomKind.indexInsightDiff : undefined}
                      data-artifact-id={id ?? undefined}
                      className={`pqat-indexInsightItem${rowHighlighted ? ' pqat-indexInsightItem--active' : ''}`}
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
                              onClick={() => {
                                setHighlightFindingDiffId(row.relatedFindingDiffIds[0]!)
                                setHighlightIndexInsightDiffId(null)
                              }}
                            >
                              Highlight finding
                            </button>
                          ) : row.relatedFindingIndexes[0] != null ? (
                            <button
                              type="button"
                              className="pqat-pillLinkBtn"
                              onClick={() => {
                                const item = comparison.findingsDiff.items[row.relatedFindingIndexes[0]!]
                                if (item?.diffId) setHighlightFindingDiffId(item.diffId)
                                setHighlightIndexInsightDiffId(null)
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
            ) : null}
            {indexSection.chunkedNuance ? (
              <div className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                Timescale-style chunked bitmap plans: indexes may already be in play; heavy I/O can still be a pruning/selectivity/shape
                problem—not only “add an index.”
              </div>
            ) : null}
          </div>
        )
      case 'summaryCompareSuggestions':
        if (compareOptimizationTop.length === 0) return null
        return (
          <section
            className="pqat-callout pqat-callout--suggestion"
            role="region"
            aria-labelledby="compare-next-steps-title"
          >
            <h2
              id="compare-next-steps-title"
              className="pqat-callout__title"
              style={{ margin: 0, fontSize: 'inherit', fontWeight: 'inherit' }}
            >
              Next steps after this change
            </h2>
            <div className="pqat-callout__hint">
              Ranked compare-scoped next steps (Plan B + diff context)—not the full Analyze suggestion list. Chips show whether a row
              targets the same Plan B node as the selected pair.
            </div>
            <ul className="pqat-bulletList">
              {compareOptimizationTop.map((s) => {
                const anchorsPair = compareSuggestionAnchorsSelectedPlanB(s, selectedPlanBNodeId)
                return (
                <li
                  key={s.suggestionId}
                  data-artifact={ArtifactDomKind.compareSuggestion}
                  data-artifact-id={s.suggestionId}
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
                    onClick={() => setHighlightSuggestionId(s.suggestionId)}
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
          </section>
        )
      case 'summaryMeta':
        return (
          <div className="pqat-metaRow">
            {comparison.comparisonStory?.overview?.trim() ? (
              <div className="pqat-callout pqat-callout--accent" style={{ marginBottom: 12 }} aria-label="Change briefing">
                <div className="pqat-callout__title">{comparisonStorySectionLabels().deck}</div>
                <p className="pqat-callout__subtitle">
                  Lead line is wall-clock posture; beats below explain where pressure moved. A faster root can still hide a worse subtree,
                  and a slower root can still show localized wins—treat both as signals, not a single headline judgment.
                </p>
                {continuitySummaryCue?.trim() ? (
                  <div
                    className="pqat-continuitySummaryCue"
                    style={{ marginTop: 8 }}
                    aria-label="Continuity cue for the selected mapped pair or primary story beat"
                  >
                    <span className="pqat-inlineMeta" id="compare-continuity-summary-label">
                      Continuity ·{' '}
                    </span>
                    <span
                      className="pqat-chip pqat-chip--suggestionMeta"
                      data-testid="compare-continuity-summary-cue"
                      aria-labelledby="compare-continuity-summary-label"
                    >
                      {continuitySummaryCue.trim()}
                    </span>
                  </div>
                ) : null}
                <div className="pqat-storyLane pqat-storyLane--orientation pqat-changeStoryLead" style={{ marginTop: 8 }}>
                  <div className="pqat-storyLane__eyebrow">{comparisonStorySectionLabels().runtime}</div>
                  <div className="pqat-storyLane__body pqat-changeStoryLead__body">{comparison.comparisonStory.overview}</div>
                </div>
                {comparison.comparisonStory.changeBeats?.length ? (
                  <div className="pqat-storyLane pqat-storyLane--pressure" style={{ marginTop: 10 }}>
                    <div className="pqat-storyLane__eyebrow">{comparisonStorySectionLabels().structure}</div>
                    <div style={{ marginTop: 4 }}>
                      {comparison.comparisonStory.changeBeats.map((raw, i) => {
                        const b = normalizeComparisonStoryBeat(raw)
                        return (
                          <div key={`cb-${i}-${b.text.slice(0, 20)}`} className="pqat-changeStoryBeat">
                            <div className="pqat-changeStoryBeat__text">{b.text}</div>
                            {b.beatBriefing?.trim() ? (
                              <div className="pqat-changeStoryBeat__briefing" aria-label="Plan B operator briefing">
                                {b.beatBriefing}
                              </div>
                            ) : null}
                            {b.focusNodeIdA && b.focusNodeIdB ? (
                              <button
                                type="button"
                                className="pqat-btn pqat-btn--sm pqat-btn--ghost"
                                style={{ marginTop: 6 }}
                                onMouseEnter={prefetchCompareSelectedPairHeavySections}
                                onFocus={prefetchCompareSelectedPairHeavySections}
                                onClick={() => setSelectedPair({ a: b.focusNodeIdA!, b: b.focusNodeIdB! })}
                              >
                                Open pair
                                {b.pairAnchorLabel?.trim() ? ` · ${b.pairAnchorLabel}` : ''}
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="pqat-storyLane pqat-storyLane--action" style={{ marginTop: 10 }}>
                  <div className="pqat-storyLane__eyebrow">{comparisonStorySectionLabels().walkthrough}</div>
                  <div className="pqat-storyLane__body">{comparison.comparisonStory.investigationPath}</div>
                </div>
                <div className="pqat-storyLane pqat-storyLane--flow" style={{ marginTop: 8 }}>
                  <div className="pqat-storyLane__eyebrow">{comparisonStorySectionLabels().readout}</div>
                  <div className="pqat-storyLane__body" style={{ opacity: 0.9 }}>
                    {comparison.comparisonStory.structuralReading}
                  </div>
                </div>
              </div>
            ) : null}
            {comparison.bottleneckBrief?.lines?.length ? (
              <div className="pqat-callout pqat-callout--muted" style={{ marginBottom: 12 }} aria-label="Bottleneck posture A vs B">
                <div className="pqat-callout__title">Bottleneck posture (A vs B)</div>
                <ul className="pqat-bulletList pqat-bulletList--tight" style={{ marginBottom: 0 }}>
                  {comparison.bottleneckBrief.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="pqat-monoMuted">
              findings: +{findingsNewCount} new · -{findingsResolvedCount} resolved
            </div>
            <details className="pqat-details pqat-details--muted">
              <summary>Narrative</summary>
              <div className="pqat-preWrap">{comparison.narrative}</div>
            </details>
            <details className="pqat-details pqat-details--muted">
              <summary>Debug ids</summary>
              <div className="pqat-debugIds">{comparison.comparisonId}</div>
            </details>
          </div>
        )
      default:
        return null
    }
  }

  if (!hasAny) return null

  return (
    <div className="pqat-summaryShell pqat-workspaceReveal" aria-labelledby="compare-summary-heading">
      <div className="pqat-summaryHeader">
        <h2 id="compare-summary-heading" className="pqat-sectionHeadline">
          Summary
        </h2>
        {vis.summaryCards ? (
          <div className="pqat-shareRow">
            {coverage ? <div className="pqat-monoMuted">{coverage}</div> : null}
            <button type="button" className="pqat-btn pqat-btn--sm" onClick={() => void copyShareCompare.copy(window.location.href, shareCompareUi.toast)}>
              {shareCompareUi.label}
            </button>
            {copyShareCompare.status ? (
              <span className="pqat-mutedSpan" role="status" aria-live="polite" aria-atomic="true">
                {copyShareCompare.status}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="pqat-mutedSpan">Metric cards hidden — restore via Customize workspace.</span>
        )}
      </div>
      {layout.summarySectionOrder.map((sid) => (
        <div key={sid}>{section(sid)}</div>
      ))}
    </div>
  )
}
