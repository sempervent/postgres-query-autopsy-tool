import type { ReactNode } from 'react'
import type { AnalysisFinding, AnalyzedPlanNode, OptimizationSuggestion, PlanAnalysisResult } from '../../api/types'
import { buildHotspots } from '../../presentation/hotspotPresentation'
import { joinLabelAndSubtitle } from '../../presentation/nodeLabels'
import { hotspotReferenceText } from '../../presentation/nodeReferences'
import { compactMetricsPreview } from '../../presentation/compactMetricsPreview'
import type { useCopyFeedback } from '../../presentation/useCopyFeedback'
import { ClickableRow } from '../ClickableRow'
import { ReferenceCopyButton } from '../ReferenceCopyButton'
import type { AnalyzeGuideSectionId } from '../../analyzeWorkspace/analyzeWorkspaceModel'
import { companionRailSurface, planGuideRailClassName } from './analyzePanelChrome'
import {
  suggestionConfidenceShort,
  suggestionFamilyLabel,
  suggestionPriorityShort,
} from '../../presentation/optimizationSuggestionsPresentation'

function severityLabel(sev: number) {
  return ['Info', 'Low', 'Medium', 'High', 'Critical'][sev] ?? String(sev)
}

export function AnalyzePlanGuideRail(props: {
  analysis: PlanAnalysisResult
  guideSectionOrder: AnalyzeGuideSectionId[]
  byId: Map<string, AnalyzedPlanNode>
  selectedNode: AnalyzedPlanNode | null
  selectedNodeId: string | null
  findingsForSelectedNode: AnalysisFinding[]
  filteredFindings: AnalysisFinding[]
  sortedOptimizationSuggestions: OptimizationSuggestion[]
  jumpToNodeId: (id: string) => void
  copyHotspot: ReturnType<typeof useCopyFeedback>
  nodeLabel: (n: AnalyzedPlanNode) => string
}) {
  const {
    analysis,
    guideSectionOrder,
    byId,
    selectedNode,
    selectedNodeId,
    findingsForSelectedNode,
    filteredFindings,
    sortedOptimizationSuggestions,
    jumpToNodeId,
    copyHotspot,
    nodeLabel,
  } = props

  const sections: Record<AnalyzeGuideSectionId, ReactNode> = {
    selection: (
      <div
        style={{
          padding: 10,
          borderRadius: 10,
          border: '1px solid var(--border)',
          marginBottom: 14,
          background: 'color-mix(in srgb, var(--bg) 96%, transparent)',
        }}
        aria-label="Selected node snapshot"
      >
        {selectedNode ? (
          <>
            <div style={{ fontSize: 10, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Selection</div>
            <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>{nodeLabel(selectedNode)}</div>
            {(() => {
              const js = joinLabelAndSubtitle(selectedNode, byId)
              if (!js?.subtitle) return null
              return <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{js.subtitle}</div>
            })()}
            {compactMetricsPreview(selectedNode.metrics as Record<string, unknown>).length ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 11, fontFamily: 'var(--mono)', opacity: 0.9 }}>
                {compactMetricsPreview(selectedNode.metrics as Record<string, unknown>).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : null}
            {findingsForSelectedNode.filter((f) => f.severity >= 3)[0] ? (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                <span style={{ fontWeight: 700 }}>Top signal:</span> {findingsForSelectedNode.filter((f) => f.severity >= 3)[0]?.title}
              </div>
            ) : findingsForSelectedNode[0] ? (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.88 }}>
                <span style={{ fontWeight: 700 }}>Finding:</span> {findingsForSelectedNode[0].title}
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
            Click the graph, a hotspot, or a finding to anchor selection here.
          </div>
        )}
      </div>
    ),
    whatHappened: (
      <>
        <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>What happened</h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 7,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
          }}
        >
          {analysis.narrative.whatHappened}
        </p>
      </>
    ),
    hotspots: (
      <>
        <h3 style={{ fontSize: 13, margin: '14px 0 8px' }}>Where to inspect next</h3>
        {(() => {
          const hs = buildHotspots(analysis)
          if (!hs.length) {
            const s = analysis.summary
            const hotspotIdCount =
              (s.topExclusiveTimeHotspotNodeIds?.length ?? 0) +
              (s.topInclusiveTimeHotspotNodeIds?.length ?? 0) +
              (s.topSharedReadHotspotNodeIds?.length ?? 0)
            const anyIds = hotspotIdCount > 0
            const msg = anyIds
              ? 'Summary listed hotspot ids but none resolved in the current node list.'
              : !s.hasActualTiming && !s.hasBuffers
                ? 'No hotspots available. Use EXPLAIN (ANALYZE, BUFFERS) so timing and shared-read lists can be built.'
                : s.hasBuffers && !s.hasActualTiming
                  ? 'No timing-based hotspots; buffer counters were detected—check shared-read hotspot ids if any.'
                  : 'No hotspot node ids were produced for this plan (sparse timing or read data).'
            return <div style={{ opacity: 0.85, fontSize: 12 }}>{msg}</div>
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hs.slice(0, 8).map((h) => (
                <ClickableRow
                  key={`${h.kind}-${h.nodeId}`}
                  selected={h.nodeId === selectedNodeId}
                  aria-label={`Hotspot: ${h.label}`}
                  onActivate={() => jumpToNodeId(h.nodeId)}
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{h.label}</div>
                    <ReferenceCopyButton
                      aria-label="Copy hotspot reference"
                      onCopy={() =>
                        copyHotspot.copy(
                          hotspotReferenceText(
                            h.nodeId,
                            byId,
                            h.kind === 'exclusiveTime'
                              ? 'exclusive runtime hotspot'
                              : h.kind === 'subtreeTime'
                                ? 'subtree runtime hotspot'
                                : 'shared reads hotspot',
                          ),
                          'Copied hotspot reference',
                        )
                      }
                    />
                  </div>
                  <div style={{ marginTop: 2, fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.82 }}>
                    {h.kind === 'exclusiveTime' ? 'exclusive runtime' : h.kind === 'subtreeTime' ? 'subtree runtime' : 'shared reads'}
                    {h.evidence ? ` · ${h.evidence}` : ''}
                  </div>
                </ClickableRow>
              ))}
            </div>
          )
        })()}
        {copyHotspot.status ? <div style={{ marginTop: 8, fontSize: 11, opacity: 0.85 }}>{copyHotspot.status}</div> : null}
      </>
    ),
    topFindings: (
      <>
        <h3 style={{ fontSize: 13, margin: '14px 0 8px' }}>Top findings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredFindings.slice(0, 4).map((f: AnalysisFinding) => {
            const anchorId = (f.nodeIds ?? [])[0]
            return (
              <ClickableRow
                key={`rail-${f.findingId}`}
                selected={!!anchorId && anchorId === selectedNodeId}
                aria-label={`Top finding: ${f.title}`}
                onActivate={() => {
                  if (anchorId) jumpToNodeId(anchorId)
                }}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'color-mix(in srgb, var(--accent-bg) 10%, transparent)',
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  [{severityLabel(f.severity)}] <span style={{ fontWeight: 700 }}>{f.title}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.88, marginTop: 4, lineHeight: 1.35 }}>{f.summary}</div>
              </ClickableRow>
            )
          })}
          {filteredFindings.length === 0 ? <div style={{ fontSize: 12, opacity: 0.8 }}>No findings match the current filter.</div> : null}
        </div>
      </>
    ),
    nextSteps:
      sortedOptimizationSuggestions.length > 0 ? (
        <>
          <h3 style={{ fontSize: 13, margin: '14px 0 8px' }}>Next steps (preview)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedOptimizationSuggestions.slice(0, 2).map((s) => {
              const target = (s.targetNodeIds ?? [])[0]
              const targetLabel = target && byId.get(target) ? nodeLabel(byId.get(target)!) : target
              const focusName = (s.targetDisplayLabel ?? targetLabel ?? target)?.trim()
              return (
                <div
                  key={`rail-sg-${s.suggestionId}`}
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  <div style={{ marginTop: 3, fontSize: 10, opacity: 0.78 }}>
                    {suggestionFamilyLabel(s.suggestionFamily)} · {suggestionConfidenceShort(s.confidence)} ·{' '}
                    {suggestionPriorityShort(s.priority)}
                  </div>
                  <div style={{ marginTop: 4, opacity: 0.9 }}>{s.summary}</div>
                  {s.recommendedNextAction ? (
                    <div style={{ marginTop: 4, opacity: 0.88, fontSize: 11 }}>
                      <span style={{ fontWeight: 650 }}>Next · </span>
                      {s.recommendedNextAction}
                    </div>
                  ) : null}
                  {target ? (
                    <button
                      type="button"
                      onClick={() => jumpToNodeId(target)}
                      style={{ marginTop: 6, fontSize: 11, padding: '4px 8px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      Focus {focusName || 'node'}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 8 }}>Full list below with rationale.</div>
        </>
      ) : null,
    sourceQuery: analysis.queryText ? (
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12 }}>Source query</summary>
        <pre style={{ marginTop: 8, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 11 }}>{analysis.queryText}</pre>
      </details>
    ) : null,
  }

  return (
    <aside aria-label="Graph companion" className={planGuideRailClassName} style={{ ...companionRailSurface, minWidth: 0 }}>
      <div className="pqat-eyebrow">Companion</div>
      <div style={{ fontWeight: 750, fontSize: '0.9375rem', letterSpacing: '-0.02em', color: 'var(--text-h)', marginBottom: 12 }}>Plan guide</div>
      {guideSectionOrder.map((sid) => {
        const el = sections[sid]
        return el ? <div key={sid}>{el}</div> : null
      })}
    </aside>
  )
}
