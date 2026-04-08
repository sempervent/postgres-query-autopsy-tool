import { lazy, Suspense } from 'react'
import type { AnalysisFinding, AnalyzedPlanNode, OptimizationSuggestion, PlanAnalysisResult } from '../../api/types'
import { joinLabelAndSubtitle } from '../../presentation/nodeLabels'
import { getWorkersFromPlanNode, workerSummaryCue } from '../../presentation/workerPresentation'
import { formatAccessPathSummaryLine, indexInsightsForNodeId } from '../../presentation/indexInsightPresentation'
import { nodeReferenceText } from '../../presentation/nodeReferences'
import { analyzeDeepLinkClipboardPayload, appUrlForPath } from '../../presentation/shareAppUrl'
import {
  analyzeDeepLinkPath,
  buildAnalyzeDeepLinkSearchParams,
  copyArtifactShareToast,
  shareArtifactLinkLabel,
} from '../../presentation/artifactLinks'
import type { AppConfig } from '../../api/types'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'
import { TechnicalIdCollapsible } from '../TechnicalIdCollapsible'
import { operatorBriefingLine } from '../../presentation/briefingReadoutPresentation'
import { bottleneckClassShortLabel } from '../../presentation/bottleneckPresentation'

const AnalyzeSelectedNodeHeavySections = lazy(() =>
  import('./AnalyzeSelectedNodeHeavySections').then((m) => ({ default: m.AnalyzeSelectedNodeHeavySections })),
)

export function AnalyzeSelectedNodePanel(props: {
  analysis: PlanAnalysisResult
  selectedNode: AnalyzedPlanNode | null
  selectedNodeId: string | null
  byId: Map<string, AnalyzedPlanNode>
  findingsForSelectedNode: AnalysisFinding[]
  relatedOptimizationForSelectedNode: OptimizationSuggestion | null
  appConfig: AppConfig | null
  locationPathname: string
  copyNode: ReturnType<typeof useCopyFeedback>
  copyShareLink: ReturnType<typeof useCopyFeedback>
  nodeLabel: (n: AnalyzedPlanNode) => string
}) {
  const {
    analysis,
    selectedNode,
    selectedNodeId,
    byId,
    findingsForSelectedNode,
    relatedOptimizationForSelectedNode,
    appConfig,
    locationPathname,
    copyNode,
    copyShareLink,
    nodeLabel,
  } = props

  const shareLinkUi = {
    label: shareArtifactLinkLabel(appConfig?.authEnabled ?? false, analysis?.artifactAccess),
    toast: copyArtifactShareToast(appConfig?.authEnabled ?? false, analysis?.artifactAccess),
  }

  return (
    <div className="pqat-panel pqat-panel--detail" style={{ minWidth: 0, padding: '16px 18px' }} aria-label="Selected node detail">
      <div className="pqat-eyebrow">Detail</div>
      <h2>Selected node</h2>
      {selectedNode ? (
        <div className="pqat-readoutShell pqat-panel pqat-panel--workspace" style={{ padding: 14, marginTop: 4 }} aria-label="Selected node readout">
          <div className="pqat-readoutKicker">Operator in focus</div>
          <div className="pqat-readoutTitle">{nodeLabel(selectedNode)}</div>
          {(() => {
            const br = operatorBriefingLine(selectedNode)
            return br ? (
              <div className="pqat-operatorBriefing" aria-label="Operator briefing">
                <div className="pqat-operatorBriefing__kicker">Briefing</div>
                {br}
              </div>
            ) : null
          })()}
          {(() => {
            const hits = (analysis.summary.bottlenecks ?? []).filter((b) => (b.nodeIds ?? []).includes(selectedNode.nodeId))
            if (!hits.length) return null
            const primary = hits.reduce((a, b) => (a.rank <= b.rank ? a : b))
            const cls = bottleneckClassShortLabel(primary.bottleneckClass)
            const kicker = primary.rank === 1 ? 'Bottleneck posture · primary target' : `Bottleneck posture · #${primary.rank} in stack`
            return (
              <div style={{ marginTop: 12 }} aria-label="How this operator ranks in bottleneck triage">
                <div style={{ fontSize: 10, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  {kicker}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                  <span className="pqat-chip pqat-chip--suggestionMeta" title="Heuristic bottleneck class">
                    {cls}
                  </span>{' '}
                  {primary.headline}
                </div>
              </div>
            )
          })()}
          {(() => {
            const js = joinLabelAndSubtitle(selectedNode, byId)
            if (!js?.subtitle) return null
            return <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{js.subtitle}</div>
          })()}
          <TechnicalIdCollapsible nodeId={selectedNode.nodeId} />
          {selectedNode.operatorInterpretation?.trim() ? (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
                background: 'color-mix(in srgb, var(--accent-bg) 18%, transparent)',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--text)',
              }}
              aria-label="Operator interpretation"
            >
              <div style={{ fontSize: 10, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                What this operator is doing
              </div>
              {selectedNode.operatorInterpretation}
            </div>
          ) : null}
          {(() => {
            const ws = getWorkersFromPlanNode(selectedNode.node)
            const cue = workerSummaryCue(ws)
            if (!cue) return null
            return (
              <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--mono)', opacity: 0.9 }} aria-label="Worker summary">
                {cue}
              </div>
            )
          })()}
          {relatedOptimizationForSelectedNode ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }} aria-label="Related optimization suggestion">
              <b>Related optimization suggestion</b>
              <div style={{ marginTop: 4, fontWeight: 700 }}>{relatedOptimizationForSelectedNode.title}</div>
              <div style={{ marginTop: 4, opacity: 0.9 }}>{relatedOptimizationForSelectedNode.summary}</div>
              {relatedOptimizationForSelectedNode.recommendedNextAction ? (
                <div style={{ marginTop: 6, opacity: 0.88, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 650 }}>Next · </span>
                  {relatedOptimizationForSelectedNode.recommendedNextAction}
                </div>
              ) : null}
            </div>
          ) : null}
          {(() => {
            const insights = indexInsightsForNodeId(analysis, selectedNode.nodeId)
            if (!insights.length) return null
            return (
              <div style={{ marginTop: 10 }} aria-label="Access path index insight">
                <b>Access path / index insight</b>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insights.map((ins) => (
                    <div
                      key={`${ins.nodeId}-${ins.headline}-${ins.signalKinds.join(',')}`}
                      style={{ fontSize: 12, lineHeight: 1.45, padding: 8, borderRadius: 10, border: '1px solid var(--border)' }}
                    >
                      <div style={{ fontFamily: 'var(--mono)', opacity: 0.9, marginBottom: 4 }}>{formatAccessPathSummaryLine(ins)}</div>
                      <div>{ins.headline}</div>
                      <div style={{ marginTop: 4, fontSize: 11, opacity: 0.75 }}>Signals: {ins.signalKinds.join(', ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="analyze-copy-node-reference"
              onClick={async (e) => {
                e.stopPropagation()
                if (!selectedNodeId) return
                const text = nodeReferenceText(selectedNodeId, byId, { analysisId: analysis.analysisId })
                await copyNode.copy(text, 'Copied node reference')
              }}
              style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              Copy reference
            </button>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation()
                if (!selectedNodeId) return
                const path = analyzeDeepLinkPath(
                  locationPathname,
                  buildAnalyzeDeepLinkSearchParams({
                    analysisId: analysis.analysisId,
                    nodeId: selectedNodeId,
                  }),
                )
                await copyShareLink.copy(
                  analyzeDeepLinkClipboardPayload(appUrlForPath(path), analysis.analysisId, selectedNodeId),
                  shareLinkUi.toast,
                )
              }}
              style={{ padding: '6px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              {shareLinkUi.label}
            </button>
            {copyNode.status ? (
              <div role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.85 }}>
                {copyNode.status}
              </div>
            ) : null}
            {copyShareLink.status ? (
              <div role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.85 }}>
                {copyShareLink.status}
              </div>
            ) : null}
          </div>
          <Suspense
            fallback={
              <div
                className="pqat-panelSkeleton"
                role="status"
                aria-busy="true"
                aria-label="Loading extended node detail"
                style={{ marginTop: 12 }}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="pqat-panelSkeleton__row" style={{ width: `${68 + (i % 4) * 6}%` }} />
                ))}
              </div>
            }
          >
            <AnalyzeSelectedNodeHeavySections
              analysis={analysis}
              selectedNode={selectedNode}
              findingsForSelectedNode={findingsForSelectedNode}
            />
          </Suspense>
        </div>
      ) : (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', opacity: 0.9 }}>
          Click a node in the tree or a finding to select a node.
        </div>
      )}
    </div>
  )
}
