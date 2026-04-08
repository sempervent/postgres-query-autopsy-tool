import { lazy, Suspense } from 'react'
import type { AnalyzedPlanNode, NodePairDetail, OptimizationSuggestion, PlanComparisonResult } from '../../api/types'
import { buildCompareDeepLinkSearchParams, compareDeepLinkPath } from '../../presentation/artifactLinks'
import { joinLabelAndSubtitle, pairShortLabel } from '../../presentation/nodeLabels'
import { pairReferenceText } from '../../presentation/nodeReferences'
import { appUrlForPath, compareDeepLinkClipboardPayload } from '../../presentation/shareAppUrl'
import { TechnicalPairIdsCollapsible } from '../TechnicalIdCollapsible'
import { pairBriefingLines } from '../../presentation/briefingReadoutPresentation'
import { pairContinuitySectionTitle } from '../../presentation/compareContinuityPresentation'

const CompareSelectedPairHeavySections = lazy(() =>
  import('./CompareSelectedPairHeavySections').then((m) => ({ default: m.CompareSelectedPairHeavySections })),
)

export type CompareSelectedPairPanelProps = {
  comparison: PlanComparisonResult
  pathname: string
  selectedDetail: NodePairDetail | null
  byIdA: Map<string, AnalyzedPlanNode>
  byIdB: Map<string, AnalyzedPlanNode>
  copyPair: { copy: (text: string, ok: string) => Promise<void>; status: string | null }
  copyDeepLink: { copy: (text: string, ok: string) => Promise<void>; status: string | null }
  highlightFindingDiffId: string | null
  highlightIndexInsightDiffId: string | null
  highlightSuggestionId: string | null
  compareOptForPair: OptimizationSuggestion | null
  pairSubtitle: (pair: NodePairDetail) => string | null
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
        Loading metrics, evidence, and finding context for this pair…
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
    highlightFindingDiffId,
    highlightIndexInsightDiffId,
    highlightSuggestionId,
    compareOptForPair,
    pairSubtitle,
  } = props

  return (
    <>
      <h2 id="compare-selected-pair-heading" style={{ marginTop: 0, color: 'var(--text-h)', fontSize: '1.05rem', fontWeight: 700 }}>
        Selected node pair
      </h2>
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
          <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="compare-copy-pair-reference"
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
                  compareDeepLinkClipboardPayload(
                    appUrlForPath(path),
                    comparison.comparisonId,
                    selectedDetail.pairArtifactId,
                  ),
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
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.92 }} aria-label="Compare suggestion for this pair">
              <b>Related compare next step</b>
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
        <p style={{ opacity: 0.85, marginTop: 8 }}>Select an improved/worsened node or diff finding to inspect a matched pair.</p>
      )}
    </>
  )
}
