import { lazy, Suspense } from 'react'
import type { AnalyzedPlanNode, NodePairDetail, OptimizationSuggestion, PlanComparisonResult } from '../../api/types'
import { buildCompareDeepLinkSearchParams, compareDeepLinkPath } from '../../presentation/artifactLinks'
import { pairShortLabel } from '../../presentation/nodeLabels'
import { pairReferenceText } from '../../presentation/nodeReferences'

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
      <h3 style={{ marginTop: 0 }}>Selected node pair</h3>
      {selectedDetail ? (
        <div style={{ fontWeight: 800 }}>{pairShortLabel(selectedDetail, byIdA, byIdB)}</div>
      ) : (
        <div style={{ opacity: 0.85 }}>Select an improved/worsened row or a diff finding to inspect.</div>
      )}
      {selectedDetail ? (
        <>
          <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={async () => {
                const text = pairReferenceText(selectedDetail, byIdA, byIdB)
                await copyPair.copy(text, 'Copied pair reference')
              }}
              style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              Copy reference
            </button>
            <button
              type="button"
              onClick={async () => {
                const params = buildCompareDeepLinkSearchParams({
                  comparisonId: comparison.comparisonId,
                  pairArtifactId: selectedDetail.pairArtifactId ?? null,
                  findingDiffId: highlightFindingDiffId,
                  indexInsightDiffId: highlightIndexInsightDiffId,
                  suggestionId: highlightSuggestionId,
                })
                const path = compareDeepLinkPath(pathname, params)
                await copyDeepLink.copy(`${window.location.origin}${path}`, 'Copied deep link')
              }}
              style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              Copy link
            </button>
            {copyPair.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyPair.status}</div> : null}
            {copyDeepLink.status ? <div style={{ fontSize: 12, opacity: 0.85 }}>{copyDeepLink.status}</div> : null}
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
