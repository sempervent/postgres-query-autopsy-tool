import { useState } from 'react'
import type { AppConfig, PlanAnalysisResult } from '../../api/types'
import { getAnalysis } from '../../api/client'
import { ArtifactSharingPanel } from '../ArtifactSharingPanel'
import { formatDeclaredExplainOptionsLine, plannerCostsLabel } from '../../presentation/explainMetadataPresentation'
import { indexOverviewSummaryLine } from '../../presentation/indexInsightPresentation'
import {
  analyzeDeepLinkPath,
  buildAnalyzeDeepLinkSearchParams,
  shareArtifactLinkLabel,
  copyArtifactShareToast,
} from '../../presentation/artifactLinks'
import { analyzeDeepLinkClipboardPayload, appUrlForPath } from '../../presentation/shareAppUrl'
import type { AnalyzeTriageBundle } from '../../presentation/analyzeOutputGuidance'
import {
  planInspectFirstSteps,
  planStoryDeckTitle,
  planStoryHasContent,
  planStorySectionLabels,
} from '../../presentation/storyPresentation'
import { normalizeStoryPropagationBeat } from '../../presentation/planReferencePresentation'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'

export type AnalyzeSummaryCardProps = {
  analysis: PlanAnalysisResult
  /** Precomputed in page — keeps takeaway + scan signals single-sourced. */
  triageBundle: AnalyzeTriageBundle
  /** Narrow layout: keep triage visible while scrolling workspace. */
  stickyTriageNarrow?: boolean
  appConfig: AppConfig | null
  sendExplainMetadata: boolean
  selectedNodeId: string | null
  locationPathname: string
  copyShareLink: ReturnType<typeof useCopyFeedback>
  setAnalysis: (a: PlanAnalysisResult) => void
  jumpToNodeId?: (id: string) => void
}

export function AnalyzeSummaryCard(props: AnalyzeSummaryCardProps) {
  const {
    analysis,
    triageBundle,
    stickyTriageNarrow,
    appConfig,
    sendExplainMetadata,
    selectedNodeId,
    locationPathname,
    copyShareLink,
    setAnalysis,
    jumpToNodeId,
  } = props
  const [sharingReloadError, setSharingReloadError] = useState<string | null>(null)

  const shareLinkUi = {
    label: shareArtifactLinkLabel(appConfig?.authEnabled ?? false, analysis?.artifactAccess),
    toast: copyArtifactShareToast(appConfig?.authEnabled ?? false, analysis?.artifactAccess),
  }

  const { takeaway, scanSignals } = triageBundle

  return (
    <div
      className={`pqat-summaryDeck pqat-workspaceReveal${stickyTriageNarrow ? ' pqat-summaryDeck--stickyNarrow' : ''}`}
      aria-label="Analysis summary"
    >
      {/*
        Visual regression (e2e-visual): contract is metrics + plan briefing only — excludes share row, ArtifactSharingPanel,
        and EXPLAIN metadata so snapshots track story surfaces without footer/meta churn (Phase 92).
      */}
      <div data-testid="analyze-visual-summary-contract">
        <div className="pqat-eyebrow">At a glance</div>
        <h3 className="pqat-commandTitle" data-testid="analyze-summary-heading">
          Summary
        </h3>
        <div className="pqat-triageDeck" data-testid="analyze-triage-deck">
          {takeaway ? (
            <div
              className="pqat-takeawayBand pqat-takeawayBand--hero pqat-takeawayBand--primary"
              data-testid="analyze-summary-takeaway"
              aria-label="What to look at first"
            >
              <p className="pqat-takeawayBand__eyebrow">Start here</p>
              <p className="pqat-takeawayBand__headline">{takeaway.headline}</p>
              <p className="pqat-takeawayBand__support">{takeaway.supportingLine}</p>
              {takeaway.focusNodeId && jumpToNodeId ? (
                <button
                  type="button"
                  className="pqat-btn pqat-btn--sm pqat-btn--primary"
                  style={{ marginTop: 10 }}
                  onClick={() => jumpToNodeId(takeaway.focusNodeId!)}
                >
                  Open in plan
                </button>
              ) : null}
            </div>
          ) : null}
          {scanSignals.length ? (
            <div
              className="pqat-scanSignals pqat-scanSignals--compact"
              data-testid="analyze-scan-signals"
              aria-label="Next signals to scan"
            >
              <div className="pqat-scanSignals__label">Then scan</div>
              <ol className="pqat-scanSignals__list pqat-scanSignals__list--ranked">
                {scanSignals.map((s, i) => (
                  <li key={s.findingId} className="pqat-scanSignals__item">
                    <span className="pqat-scanSignals__rank" aria-hidden="true">
                      {i + 2}
                    </span>
                    <span className="pqat-scanSignals__title">{s.label}</span>
                    {s.focusNodeId && jumpToNodeId ? (
                      <button
                        type="button"
                        className="pqat-btn pqat-btn--sm pqat-btn--ghost pqat-scanSignals__jump"
                        onClick={() => jumpToNodeId(s.focusNodeId!)}
                      >
                        Open in plan
                      </button>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
        <details className="pqat-details pqat-details--muted" style={{ marginTop: 10 }}>
          <summary>Analysis id &amp; plan counts</summary>
          <div className="pqat-detailsBody">
            <div className="pqat-metricGrid pqat-metricGrid--deck" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
              <div className="pqat-metricTile">
                <div className="pqat-metricTile__label">Analysis id</div>
                <div style={{ fontFamily: 'var(--mono)', wordBreak: 'break-all', fontSize: 13, marginTop: 6, color: 'var(--text-h)' }}>
                  {analysis.analysisId}
                </div>
              </div>
              <div className="pqat-metricTile">
                <div className="pqat-metricTile__label">Plan metrics</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginTop: 6, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  nodes={analysis.summary.totalNodeCount} depth={analysis.summary.maxDepth} severe={analysis.summary.severeFindingsCount}{' '}
                  timing={String(analysis.summary.hasActualTiming)} buffers={String(analysis.summary.hasBuffers)} plannerCosts=
                  {String(analysis.summary.plannerCosts ?? 'unknown')}
                </div>
              </div>
            </div>
          </div>
        </details>
        {planStoryHasContent(analysis.planStory) ? (
        <div
          className="pqat-callout pqat-callout--accent"
          style={{ marginTop: 14 }}
          aria-label="Structured plan briefing"
        >
          <div className="pqat-callout__title">{planStoryDeckTitle()}</div>
          <p className="pqat-planBriefingHint" style={{ marginBottom: 8 }}>
            Use <strong>Plan guide</strong> for the selected node; <strong>Findings</strong> for ranked evidence.
          </p>
          <details className="pqat-details pqat-details--muted" style={{ marginTop: 4 }}>
            <summary>Bottleneck vs suggestion panels</summary>
            <p className="pqat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
              Bottlenecks = time/read concentration; suggestions = experiments to try.
            </p>
          </details>
          {(() => {
            const L = planStorySectionLabels()
            const startHereLane = (
              <div className="pqat-storyLane pqat-storyLane--action pqat-storyLane--triageLead" style={{ marginTop: 12 }}>
                <div className="pqat-storyLane__eyebrow">{L.startHere}</div>
                {(() => {
                  const steps = planInspectFirstSteps(analysis.planStory)
                  if (!steps.length) {
                    return <div className="pqat-storyLane__body">{analysis.planStory!.inspectFirstPath}</div>
                  }
                  return (
                    <ol
                      className="pqat-inspectFirstSteps"
                      style={{ margin: '6px 0 0', paddingLeft: 20, lineHeight: 1.5 }}
                      aria-label="Ordered inspect steps"
                    >
                      {steps.map((st) => (
                        <li key={st.stepNumber} style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{st.title}</div>
                          <div style={{ marginTop: 4 }}>{st.body}</div>
                          {st.focusNodeId?.trim() && jumpToNodeId ? (
                            <button
                              type="button"
                              className="pqat-btn pqat-btn--sm pqat-btn--ghost"
                              style={{ marginTop: 8 }}
                              onClick={() => jumpToNodeId(st.focusNodeId!)}
                            >
                              Focus in plan
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )
                })()}
              </div>
            )
            return (
              <>
                {startHereLane}
                <details className="pqat-details pqat-details--muted" style={{ marginTop: 10 }}>
                  <summary>Overview, work focus, and cost drivers</summary>
                  <div className="pqat-detailsBody">
                    <div className="pqat-storyLane pqat-storyLane--orientation" style={{ marginTop: 8 }}>
                      <div className="pqat-storyLane__eyebrow">{L.orientation}</div>
                      <div className="pqat-storyLane__body">{analysis.planStory!.planOverview}</div>
                    </div>
                    <div className="pqat-storyLane pqat-storyLane--pressure" style={{ marginTop: 8 }}>
                      <div className="pqat-storyLane__eyebrow">{L.work}</div>
                      <div className="pqat-storyLane__body">{analysis.planStory!.workConcentration}</div>
                    </div>
                    <div className="pqat-storyLane pqat-storyLane--pressure" style={{ marginTop: 8 }}>
                      <div className="pqat-storyLane__eyebrow">{L.drivers}</div>
                      <div className="pqat-storyLane__body">{analysis.planStory!.likelyExpenseDrivers}</div>
                    </div>
                  </div>
                </details>
              </>
            )
          })()}
          {analysis.planStory!.propagationBeats?.length || analysis.planStory!.indexShapeNote?.trim() ? (
            <details className="pqat-details pqat-details--muted" style={{ marginTop: 10 }}>
              <summary>More plan context (flow &amp; index shape)</summary>
              <div className="pqat-detailsBody">
                {analysis.planStory!.propagationBeats?.length ? (
                  <div className="pqat-storyLane pqat-storyLane--flow" style={{ marginTop: 4 }}>
                    <div className="pqat-storyLane__eyebrow">{planStorySectionLabels().flow}</div>
                    <ul style={{ margin: 0, padding: 0 }}>
                      {analysis.planStory!.propagationBeats.map((raw, i) => {
                        const b = normalizeStoryPropagationBeat(raw)
                        return (
                          <li key={`${i}-${b.text.slice(0, 24)}`} className="pqat-storyBeatRow" style={{ paddingLeft: 10, marginBottom: 8 }}>
                            <div className="pqat-storyBeatRow__text">{b.text}</div>
                            {b.focusNodeId && jumpToNodeId ? (
                              <button
                                type="button"
                                className="pqat-btn pqat-btn--sm pqat-btn--ghost"
                                style={{ marginTop: 6 }}
                                onClick={() => jumpToNodeId(b.focusNodeId!)}
                              >
                                Focus {b.anchorLabel?.trim() ? `· ${b.anchorLabel}` : 'operator'}
                              </button>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
                {analysis.planStory!.indexShapeNote?.trim() ? (
                  <div className="pqat-storyLane pqat-storyLane--orientation" style={{ marginTop: 10 }}>
                    <div className="pqat-storyLane__eyebrow">{planStorySectionLabels().indexShape}</div>
                    <div className="pqat-storyLane__body">{analysis.planStory!.indexShapeNote}</div>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
      </div>
      {analysis.planInputNormalization ? (
        <div className="pqat-hint" style={{ marginTop: 12 }} aria-label="Plan input normalization">
          {analysis.planInputNormalization.kind === 'queryPlanTable'
            ? 'Normalized pasted QUERY PLAN output'
            : analysis.planInputNormalization.kind === 'rawJson'
              ? 'Parsed raw JSON directly'
              : `Input normalization: ${analysis.planInputNormalization.kind}`}
        </div>
      ) : null}
      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          className="pqat-btn pqat-btn--sm pqat-btn--primary"
          onClick={async () => {
            const path = analyzeDeepLinkPath(
              locationPathname,
              buildAnalyzeDeepLinkSearchParams({
                analysisId: analysis.analysisId,
                nodeId: selectedNodeId,
              }),
            )
            await copyShareLink.copy(
              analyzeDeepLinkClipboardPayload(appUrlForPath(path), analysis.analysisId, selectedNodeId, {
                startHereHeadline: takeaway?.headline,
              }),
              shareLinkUi.toast,
            )
          }}
        >
          {shareLinkUi.label}
        </button>
        {copyShareLink.status ? (
          <span className="pqat-hint" role="status" aria-live="polite" aria-atomic="true" style={{ margin: 0 }}>
            {copyShareLink.status}
          </span>
        ) : null}
      </div>
      <div className="pqat-hint" style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 11 }}>
        Saved in this workspace. The link keeps working across restarts while this data stays available.
        {appConfig?.authEnabled ? ' When you’re signed in, sharing controls who can open it.' : ''}
      </div>
      {sharingReloadError ? (
        <div className="pqat-hint" style={{ marginTop: 10, color: 'var(--text-h)' }} role="alert">
          {sharingReloadError}
        </div>
      ) : null}
      <ArtifactSharingPanel
        authEnabled={appConfig?.authEnabled ?? false}
        authIdentityKind={appConfig?.authIdentityKind}
        authHelp={appConfig?.authHelp}
        kind="analysis"
        artifactId={analysis.analysisId}
        artifactAccess={analysis.artifactAccess}
        onSaved={async () => {
          setSharingReloadError(null)
          try {
            const data = await getAnalysis(analysis.analysisId)
            setAnalysis(data)
          } catch (e) {
            setSharingReloadError(e instanceof Error ? e.message : String(e))
          }
        }}
      />
      <details
        className="pqat-details pqat-details--muted pqat-details--meta"
        style={{ marginTop: 16, paddingTop: 4, borderTop: '1px solid var(--border-subtle)', fontSize: 13 }}
      >
        <summary>Plan source &amp; EXPLAIN metadata</summary>
        <div className="pqat-detailsBody" aria-label="Plan source and EXPLAIN metadata">
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <li>Source query: {analysis.queryText?.trim() ? 'provided' : 'not provided'}</li>
            <li>{plannerCostsLabel(analysis.summary.plannerCosts)}</li>
            {analysis.explainMetadata?.options ? (
              <li>
                Declared EXPLAIN options (captured): {formatDeclaredExplainOptionsLine(analysis.explainMetadata) ?? '—'}
              </li>
            ) : sendExplainMetadata ? (
              <li>No declared options returned (empty metadata).</li>
            ) : (
              <li>Declared EXPLAIN options were not sent with this request.</li>
            )}
            {analysis.explainMetadata?.sourceExplainCommand?.trim() ? (
              <li style={{ marginTop: 6 }}>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.85 }}>Recorded command</span>
                <pre
                  style={{
                    margin: '4px 0 0',
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {analysis.explainMetadata.sourceExplainCommand.trim()}
                </pre>
              </li>
            ) : null}
          </ul>
        </div>
      </details>
      {analysis.summary.warnings?.length ? (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <b>Limitations:</b>
          <ul style={{ marginTop: 6 }}>
            {analysis.summary.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {(() => {
        const line = indexOverviewSummaryLine(analysis.indexOverview ?? null)
        if (!line) return null
        return (
          <div style={{ marginTop: 10, fontSize: 12, fontFamily: 'var(--mono)', opacity: 0.9 }} aria-label="Plan index overview">
            <b>Index posture:</b> {line}
          </div>
        )
      })()}
    </div>
  )
}
