import { lazy, Suspense, useId } from 'react'
import type { AnalyzedPlanNode, NodePairDetail, OptimizationSuggestion, PlanComparisonResult } from '../../api/types'
import {
  buildCompareDeepLinkSearchParams,
  compareDeepLinkPath,
  formatComparePinnedSummaryLine,
} from '../../presentation/artifactLinks'
import { joinLabelAndSubtitle, pairShortLabel } from '../../presentation/nodeLabels'
import { pairReferenceText } from '../../presentation/nodeReferences'
import { appUrlForPath, compareCompactPinContextPayload, compareDeepLinkClipboardPayload } from '../../presentation/shareAppUrl'
import { TechnicalPairIdsCollapsible } from '../TechnicalIdCollapsible'
import { pairBriefingLines } from '../../presentation/briefingReadoutPresentation'
import { pairContinuitySectionTitle } from '../../presentation/compareContinuityPresentation'
import {
  comparePairHandoffDisplayText,
  type ComparePairHandoffKind,
  type ComparePairHandoffOrigin,
} from './comparePairHandoffCopy'

const CompareSelectedPairHeavySections = lazy(() =>
  import('./CompareSelectedPairHeavySections').then((m) => ({ default: m.CompareSelectedPairHeavySections })),
)

export type { ComparePairHandoffKind, ComparePairHandoffOrigin }

export type CompareSelectedPairPanelProps = {
  comparison: PlanComparisonResult
  pathname: string
  selectedDetail: NodePairDetail | null
  byIdA: Map<string, AnalyzedPlanNode>
  byIdB: Map<string, AnalyzedPlanNode>
  copyPair: { copy: (text: string, ok: string) => Promise<void>; status: string | null }
  copyDeepLink: { copy: (text: string, ok: string) => Promise<void>; status: string | null }
  /** Short chat paste: PQAT line + pair ref + pinned summary (no URL). Phase 96. */
  copyPinContext: { copy: (text: string, ok: string) => Promise<void>; status: string | null }
  highlightFindingDiffId: string | null
  highlightIndexInsightDiffId: string | null
  highlightSuggestionId: string | null
  compareOptForPair: OptimizationSuggestion | null
  pairSubtitle: (pair: NodePairDetail) => string | null
  /** Compact handoff from summary / pins / navigator ranking (Phase 110). */
  triageBridgeLine?: string | null
  /** When the bridge is empty, carry summary continuity into the pair (e.g. URL-opened highlights — Phase 112–113). */
  continuityPairFallback?: { label: string; body: string } | null
  /** Compact thread hint beside the pair heading (Phase 131). */
  pairHandoffKind?: ComparePairHandoffKind | null
  /** Saved artifact link vs comparison run this session — refines handoff wording (Phase 132). */
  pairHandoffOrigin?: ComparePairHandoffOrigin
}

function PairHeavyFallback() {
  return (
    <div
      className="pqat-panelSkeleton pqat-pairHeavySkeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading pair metrics and evidence"
      style={{ marginTop: 12 }}
    >
      <p className="pqat-hint pqat-panelHintDense" style={{ margin: '0 0 8px', color: 'var(--text-secondary)' }}>
        Loading metrics and evidence for this pair…
      </p>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="pqat-panelSkeleton__row" style={{ width: `${68 + (i % 4) * 7}%` }} />
      ))}
    </div>
  )
}

export function CompareSelectedPairPanel(props: CompareSelectedPairPanelProps) {
  const {
    comparison,
    pathname,
    selectedDetail,
    byIdA,
    byIdB,
    copyPair,
    copyDeepLink,
    copyPinContext,
    highlightFindingDiffId,
    highlightIndexInsightDiffId,
    highlightSuggestionId,
    compareOptForPair,
    pairSubtitle,
    triageBridgeLine,
    continuityPairFallback,
    pairHandoffKind: pairHandoffKindProp,
    pairHandoffOrigin = 'session',
  } = props

  const pairContinuityId = useId()
  const pairHandoffKind = selectedDetail ? (pairHandoffKindProp ?? 'navigator') : null
  /** Region carries supplementary text once (Phase 133); avoid duplicating on the heading. */
  const pairRegionDescribedBy = pairHandoffKind ? pairContinuityId : undefined

  const pinnedSummaryLine = formatComparePinnedSummaryLine({
    findingDiffId: highlightFindingDiffId,
    indexInsightDiffId: highlightIndexInsightDiffId,
    suggestionId: highlightSuggestionId,
  })

  return (
    <>
      {pairHandoffKind ? (
        <div
          data-testid="compare-visual-pair-continuation-contract"
          className="pqat-comparePairContinuityBand"
          role="region"
          aria-labelledby="compare-selected-pair-heading"
          aria-describedby={pairRegionDescribedBy}
        >
          <div className="pqat-comparePairContinuityBand__head">
            <div className="pqat-eyebrow">Pair</div>
            <span
              data-testid="compare-pair-handoff-hint"
              data-pqat-handoff-origin={pairHandoffOrigin}
              id={pairContinuityId}
              className="pqat-comparePairThreadHint"
            >
              {comparePairHandoffDisplayText(pairHandoffKind, pairHandoffOrigin)}
            </span>
          </div>
          <h2 id="compare-selected-pair-heading" style={{ marginTop: 0, color: 'var(--text-h)', fontSize: '1.05rem', fontWeight: 700 }}>
            Selected node pair
          </h2>
        </div>
      ) : (
        <h2 id="compare-selected-pair-heading" style={{ marginTop: 0, color: 'var(--text-h)', fontSize: '1.05rem', fontWeight: 700 }}>
          Selected node pair
        </h2>
      )}
      {selectedDetail && triageBridgeLine?.trim() ? (
        <div
          className="pqat-comparePairTriageBridge"
          data-testid="compare-selected-pair-triage-bridge"
          role="note"
          aria-label="How this pair connects to the summary"
        >
          <div className="pqat-comparePairTriageBridge__label">Context</div>
          <div>{triageBridgeLine.trim()}</div>
        </div>
      ) : selectedDetail && continuityPairFallback?.body?.trim() ? (
        <div
          className="pqat-comparePairTriageBridge pqat-comparePairTriageBridge--soft"
          data-testid="compare-selected-pair-continuity-fallback"
          role="note"
          aria-label="How this pair relates to the change briefing"
        >
          <div className="pqat-comparePairTriageBridge__label">{continuityPairFallback.label.trim() || 'Reading thread'}</div>
          <div>{continuityPairFallback.body.trim()}</div>
        </div>
      ) : null}
      {selectedDetail ? (
        <div className="pqat-readoutShell" style={{ marginTop: 4 }} aria-label="Pair readout">
          <div className="pqat-readoutKicker">Matched operators</div>
          <div className="pqat-readoutTitle">{pairShortLabel(selectedDetail, byIdA, byIdB)}</div>
          {selectedDetail.regionContinuityHint ? (
            <div
              className="pqat-readoutShell pqat-regionContinuity"
              style={{ marginTop: 8, padding: '8px 10px' }}
              role="region"
              aria-label="Region continuity for this pair"
            >
              <div className="pqat-readoutKicker">{pairContinuitySectionTitle(selectedDetail.regionContinuityHint)}</div>
              <div className="pqat-hint" style={{ marginTop: 4, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                {selectedDetail.regionContinuityHint}
              </div>
            </div>
          ) : null}
          {selectedDetail.rewriteVerdictOneLiner?.trim() ? (
            <div
              className="pqat-readoutShell pqat-pairRewriteVerdict"
              style={{ marginTop: 8, padding: '8px 10px' }}
              role="region"
              aria-label="Rewrite outcome for this pair"
            >
              <div className="pqat-readoutKicker">Rewrite outcome</div>
              <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.45 }}>{selectedDetail.rewriteVerdictOneLiner}</div>
            </div>
          ) : null}
          {(() => {
            const na = byIdA.get(selectedDetail.identity.nodeIdA)
            const nb = byIdB.get(selectedDetail.identity.nodeIdB)
            const { lineA, lineB } = pairBriefingLines(na, nb)
            if (!lineA && !lineB) return null
            return (
              <div className="pqat-pairBriefingGrid" aria-label="Per-plan briefing lines">
                {lineA ? (
                  <div className="pqat-operatorBriefing">
                    <div className="pqat-operatorBriefing__kicker">Plan A briefing</div>
                    {lineA}
                  </div>
                ) : null}
                {lineB ? (
                  <div className="pqat-operatorBriefing">
                    <div className="pqat-operatorBriefing__kicker">Plan B briefing</div>
                    {lineB}
                  </div>
                ) : null}
              </div>
            )
          })()}
          {(() => {
            const na = byIdA.get(selectedDetail.identity.nodeIdA)
            const nb = byIdB.get(selectedDetail.identity.nodeIdB)
            const parts: string[] = []
            const ja = na ? joinLabelAndSubtitle(na, byIdA) : null
            const jb = nb ? joinLabelAndSubtitle(nb, byIdB) : null
            if (ja?.subtitle) parts.push(`A: ${ja.subtitle}`)
            if (jb?.subtitle) parts.push(`B: ${jb.subtitle}`)
            if (!parts.length) return null
            return (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>{parts.join(' · ')}</div>
            )
          })()}
          <TechnicalPairIdsCollapsible nodeIdA={selectedDetail.identity.nodeIdA} nodeIdB={selectedDetail.identity.nodeIdB} />
        </div>
      ) : (
        <div style={{ opacity: 0.85 }}>Select an improved/worsened row or a diff finding to inspect.</div>
      )}
      {selectedDetail ? (
        <>
          {pinnedSummaryLine ? (
            <div
              className="pqat-hint"
              data-testid="compare-pinned-summary"
              style={{ marginTop: 8, marginBottom: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)' }}
              aria-live="polite"
            >
              {pinnedSummaryLine}
            </div>
          ) : null}
          {pinnedSummaryLine ? (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                data-testid="compare-copy-pin-context"
                className="pqat-btn pqat-btn--sm pqat-btn--ghost"
                aria-label="Copy pin context: ticket text without URL"
                title="Pin context: short block for chat/tickets (no URL). Not a shareable deep link—use Copy link for that, or the guide footer’s merged/entry guided links for onboarding (?guide=1)."
                onClick={async () => {
                  const text = compareCompactPinContextPayload(
                    comparison.comparisonId,
                    selectedDetail.pairArtifactId ?? null,
                    {
                      findingDiffId: highlightFindingDiffId,
                      indexInsightDiffId: highlightIndexInsightDiffId,
                      suggestionId: highlightSuggestionId,
                    },
                    { rewriteOutcomeOneLiner: selectedDetail.rewriteVerdictOneLiner ?? null },
                  )
                  if (text) await copyPinContext.copy(text, 'Copied pin context')
                }}
              >
                Copy pin context
              </button>
              {copyPinContext.status ? (
                <span role="status" aria-live="polite" style={{ fontSize: 12, opacity: 0.85 }}>
                  {copyPinContext.status}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="pqat-help-inline" style={{ marginTop: 10 }} data-testid="compare-copy-actions-hint">
            <strong>Copy reference</strong> = human pair summary. <strong>Copy link</strong> = shareable URL for this comparison (plus pins when set).{' '}
            <strong>Copy pin context</strong> = ticket/chat text only (no URL). For onboarding, use the guide’s <strong>Copy merged guided link</strong> (keeps this view’s query) or{' '}
            <strong>Copy entry guided link</strong> (<code>?guide=1</code> only)—not these snapshot actions.
          </p>
          <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="compare-copy-pair-reference"
              aria-label="Copy reference: human-readable pair summary for tickets"
              title="Human-readable pair summary (PQAT compare line, operators, rewrite outcome). Not the shareable URL—use Copy link for that."
              onClick={async () => {
                const text = pairReferenceText(selectedDetail, byIdA, byIdB, {
                  comparisonId: comparison.comparisonId,
                  includeRewriteOutcome: true,
                })
                await copyPair.copy(text, 'Copied pair reference')
              }}
              style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              Copy reference
            </button>
            <button
              type="button"
              data-testid="compare-copy-deep-link"
              aria-label="Copy link: shareable URL and pinned compare state"
              title="Shareable link: URL + PQAT compare line + Pair ref + pinned finding/index/suggestion when set. Different from the guide’s merged/entry guided links (?guide=1 onboarding only)."
              onClick={async () => {
                const params = buildCompareDeepLinkSearchParams({
                  comparisonId: comparison.comparisonId,
                  pairArtifactId: selectedDetail.pairArtifactId ?? null,
                  findingDiffId: highlightFindingDiffId,
                  indexInsightDiffId: highlightIndexInsightDiffId,
                  suggestionId: highlightSuggestionId,
                })
                const path = compareDeepLinkPath(pathname, params)
                await copyDeepLink.copy(
                  compareDeepLinkClipboardPayload(appUrlForPath(path), comparison.comparisonId, selectedDetail.pairArtifactId, {
                    findingDiffId: highlightFindingDiffId,
                    indexInsightDiffId: highlightIndexInsightDiffId,
                    suggestionId: highlightSuggestionId,
                  }),
                  'Copied deep link',
                )
              }}
              style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              Copy link
            </button>
            {copyPair.status ? (
              <div role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.85 }}>
                {copyPair.status}
              </div>
            ) : null}
            {copyDeepLink.status ? (
              <div role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.85 }}>
                {copyDeepLink.status}
              </div>
            ) : null}
          </div>
          {pairSubtitle(selectedDetail) ? (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{pairSubtitle(selectedDetail)}</div>
          ) : null}
          {compareOptForPair ? (
            <div
              className="pqat-comparePairNextStep"
              style={{ marginTop: 10, fontSize: 12, opacity: 0.92 }}
              aria-label="Suggested follow-up for this pair"
            >
              <b>Suggested follow-up</b>
              <div style={{ marginTop: 4, fontWeight: 700 }}>{compareOptForPair.title}</div>
              <div style={{ marginTop: 4 }}>{compareOptForPair.summary}</div>
              {compareOptForPair.recommendedNextAction ? (
                <div style={{ marginTop: 6, lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 650 }}>Next · </span>
                  {compareOptForPair.recommendedNextAction}
                </div>
              ) : null}
              {compareOptForPair.whyItMatters ? (
                <div style={{ marginTop: 4, lineHeight: 1.45, opacity: 0.9 }}>
                  <span style={{ fontWeight: 650 }}>Why · </span>
                  {compareOptForPair.whyItMatters}
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
              confidence: {selectedDetail.identity.matchConfidence} · score {Number(selectedDetail.identity.matchScore).toFixed(2)}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.9 }}>
              depth {selectedDetail.identity.depthA} → {selectedDetail.identity.depthB}
            </div>
          </div>
          <Suspense fallback={<PairHeavyFallback />}>
            <CompareSelectedPairHeavySections
              comparison={comparison}
              selectedDetail={selectedDetail}
              byIdA={byIdA}
              byIdB={byIdB}
            />
          </Suspense>
        </>
      ) : (
        <p style={{ opacity: 0.85, marginTop: 8 }}>
          Pick a row in the navigator — worsened, improved, or a finding change — to open the matched pair here.
        </p>
      )}
    </>
  )
}
