import type { AppConfig, OptimizationSuggestion, PlanComparisonResult } from '../../api/types'
import type { CompareIndexSectionModel } from '../../presentation/comparePresentation'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'
import type { CompareSummarySectionId, CompareWorkspaceLayoutState } from '../../compareWorkspace/compareWorkspaceModel'
import { ArtifactSharingPanel } from '../ArtifactSharingPanel'
import { CompareCaptureContextColumn } from './CompareCaptureContextColumn'
import { CompareIndexInsightRows } from './CompareIndexInsightRows'
import { CompareNextStepsList } from './CompareNextStepsList'
import { prefetchCompareSelectedPairHeavySections } from './prefetchCompareSelectedPairHeavySections'
import { ArtifactDomKind, scrollArtifactIntoView } from '../../presentation/artifactLinks'
import { compareFollowUpDiffSignals, compareLeadTakeaway } from '../../presentation/compareOutputGuidance'
import { normalizeComparisonStoryBeat } from '../../presentation/planReferencePresentation'
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
  /** Narrow viewports: keep summary triage visible while scrolling the workspace. */
  summaryStickyNarrow?: boolean
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
    summaryStickyNarrow,
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
              Saved as <span className="pqat-monoMuted">{comparison.comparisonId}</span>. Keep the URL to reopen while this snapshot is still
              stored.
              {appConfig?.authEnabled ? ' When signed in, use Sharing below to control who can open it.' : ''}
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
      case 'summaryIndexChanges': {
        if (!indexSection || (indexSection.overviewLines.length === 0 && indexSection.topInsightDiffs.length === 0)) return null
        return (
          <div className="pqat-callout pqat-callout--accent" data-testid="compare-index-changes-callout">
            <div className="pqat-callout__title">Index changes</div>
            <p className="pqat-hint" style={{ fontSize: '0.8125rem', margin: '0 0 8px', color: 'var(--text-secondary)' }}>
              Select a row to choose what Copy link includes.
            </p>
            <details className="pqat-details pqat-details--muted" style={{ marginBottom: 8 }}>
              <summary>Keyboard shortcuts</summary>
              <p className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                Arrow keys move between rows; Enter selects one pin at a time.
              </p>
            </details>
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
              <CompareIndexInsightRows
                indexSection={indexSection}
                comparison={comparison}
                highlightIndexInsightDiffId={highlightIndexInsightDiffId}
                setHighlightFindingDiffId={setHighlightFindingDiffId}
                setHighlightIndexInsightDiffId={setHighlightIndexInsightDiffId}
                setHighlightSuggestionId={setHighlightSuggestionId}
              />
            ) : null}
            {indexSection.chunkedNuance ? (
              <details className="pqat-details pqat-details--muted" style={{ marginTop: 8 }}>
                <summary>Chunked / Timescale nuance</summary>
                <div className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                  Indexes may already be in play; heavy I/O can still be pruning, selectivity, or shape—not only “add an index.”
                </div>
              </details>
            ) : null}
          </div>
        )
      }
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
              Scoped to Plan B and this comparison. Chips call out rows that line up with the selected pair&apos;s Plan B node.
              <details className="pqat-details pqat-details--muted" style={{ marginTop: 8 }}>
                <summary>Copy link</summary>
                <p className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                  One selection at a time across next steps, finding changes, and index rows.
                </p>
              </details>
            </div>
            <CompareNextStepsList
              comparison={comparison}
              compareOptimizationTop={compareOptimizationTop}
              selectedPlanBNodeId={selectedPlanBNodeId}
              selectedPairArtifactId={selectedPairArtifactId}
              highlightSuggestionId={highlightSuggestionId}
              setHighlightFindingDiffId={setHighlightFindingDiffId}
              setHighlightIndexInsightDiffId={setHighlightIndexInsightDiffId}
              setHighlightSuggestionId={setHighlightSuggestionId}
              setSelectedPair={setSelectedPair}
              copyCompareSuggestion={copyCompareSuggestion}
            />
          </section>
        )
      case 'summaryMeta':
        return (
          <div className="pqat-metaRow">
            {comparison.comparisonStory?.overview?.trim() ? (
              <div className="pqat-callout pqat-callout--accent" style={{ marginBottom: 12 }} aria-label="Change briefing">
                <div className="pqat-callout__title">{comparisonStorySectionLabels().deck}</div>
                <div className="pqat-triageDeck" data-testid="compare-triage-deck">
                  {(() => {
                    const lead = compareLeadTakeaway(comparison)
                    return lead ? (
                      <div
                        className="pqat-takeawayBand pqat-takeawayBand--hero pqat-takeawayBand--primary"
                        style={{ marginBottom: 12 }}
                        data-testid="compare-summary-takeaway"
                      >
                        <p className="pqat-takeawayBand__eyebrow">Start here</p>
                        <p className="pqat-takeawayBand__headline">{lead.headline}</p>
                        <p className="pqat-takeawayBand__support" style={{ fontSize: '0.9375rem', color: 'var(--text-h)', fontWeight: 600 }}>
                          {lead.line}
                        </p>
                      </div>
                    ) : null
                  })()}
                  {(() => {
                    const signals = compareFollowUpDiffSignals(comparison, 2)
                    if (!signals.length) return null
                    return (
                      <div
                        className="pqat-scanSignals pqat-scanSignals--compact"
                        data-testid="compare-scan-signals"
                        style={{ marginBottom: 12 }}
                        aria-label="Next finding diffs to open"
                      >
                        <div className="pqat-scanSignals__label">Also worth opening below</div>
                        <ol className="pqat-scanSignals__list pqat-scanSignals__list--ranked">
                          {signals.map((s, i) => (
                            <li key={`${s.title}-${s.diffId ?? 'x'}`} className="pqat-scanSignals__item">
                              <span className="pqat-scanSignals__rank" aria-hidden="true">
                                {i + 2}
                              </span>
                              <span className="pqat-scanSignals__title">{s.title}</span>
                              {s.diffId ? (
                                <button
                                  type="button"
                                  className="pqat-btn pqat-btn--sm pqat-btn--primary pqat-scanSignals__jump"
                                  data-testid={`compare-scan-open-diff-${s.diffId}`}
                                  onClick={() => {
                                    setHighlightFindingDiffId(s.diffId!)
                                    window.requestAnimationFrame(() =>
                                      scrollArtifactIntoView(ArtifactDomKind.findingDiff, s.diffId!),
                                    )
                                  }}
                                >
                                  Show in list
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )
                  })()}
                </div>
                <details className="pqat-details pqat-details--muted" style={{ marginBottom: 10 }}>
                  <summary>How to read wall-clock vs structure</summary>
                  <p className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                    The lead line is wall-clock posture; beats below show where work moved. A faster root can still hide a worse subtree, and
                    a slower root can still show localized wins—treat them as signals, not one headline verdict.
                  </p>
                </details>
                {continuitySummaryCue?.trim() ? (
                  <div
                    className="pqat-continuitySummaryCue"
                    style={{ marginTop: 8 }}
                    aria-label="Reading thread for the selected pair or primary story beat"
                  >
                    <span className="pqat-inlineMeta" id="compare-continuity-summary-label">
                      Reading thread ·{' '}
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
                              <details className="pqat-details pqat-details--muted" style={{ marginTop: 6 }}>
                                <summary>Plan B detail</summary>
                                <div className="pqat-changeStoryBeat__briefing" style={{ marginTop: 8 }} aria-label="Plan B operator briefing">
                                  {b.beatBriefing}
                                </div>
                              </details>
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
                <details className="pqat-details pqat-details--muted" style={{ marginTop: 10 }}>
                  <summary>Walkthrough and structural readout</summary>
                  <div className="pqat-detailsBody">
                    <div className="pqat-storyLane pqat-storyLane--action" style={{ marginTop: 8 }}>
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
                </details>
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
    <div
      className={`pqat-summaryShell pqat-workspaceReveal${summaryStickyNarrow ? ' pqat-summaryShell--stickyNarrow' : ''}`}
      aria-labelledby="compare-summary-heading"
    >
      <div className="pqat-summaryHeader">
        <h2 id="compare-summary-heading" className="pqat-sectionHeadline">
          Summary
        </h2>
        <p className="pqat-help-inline" style={{ margin: '0 0 8px' }} data-testid="compare-summary-lanes-hint">
          Start with <strong>Change briefing</strong>, then use Index changes and Next steps to shape what <strong>Copy link</strong> carries.
        </p>
        <details className="pqat-details pqat-details--muted" style={{ marginBottom: 10 }}>
          <summary>How this page fits together</summary>
          <p className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Briefing orients you; index and next-step panels are where you pick focus for sharing.
          </p>
        </details>
        {vis.summaryCards ? (
          <div className="pqat-shareRow">
            {coverage ? <div className="pqat-monoMuted">{coverage}</div> : null}
            <button
              type="button"
              className="pqat-btn pqat-btn--sm"
              title="Copy this page’s URL, including comparison id and any pins in the address bar."
              onClick={() => void copyShareCompare.copy(window.location.href, shareCompareUi.toast)}
            >
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
