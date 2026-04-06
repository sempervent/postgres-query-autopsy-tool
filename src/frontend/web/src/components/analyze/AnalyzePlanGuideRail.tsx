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
import {
  bottleneckCauseHintLine,
  bottleneckClassShortLabel,
  bottleneckKindShortLabel,
  bottlenecksForSummary,
} from '../../presentation/bottleneckPresentation'
import { normalizeStoryPropagationBeat } from '../../presentation/planReferencePresentation'
import { planStorySectionLabels } from '../../presentation/storyPresentation'
import { TechnicalIdCollapsible } from '../TechnicalIdCollapsible'
import { operatorBriefingLine } from '../../presentation/briefingReadoutPresentation'

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

  const storyLbl = planStorySectionLabels()

  const sections: Record<AnalyzeGuideSectionId, ReactNode> = {
    selection: (
      <div className="pqat-readoutShell" style={{ marginBottom: 14 }} aria-label="Selected node snapshot">
        {selectedNode ? (
          <>
            <div className="pqat-readoutKicker">Focused operator</div>
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
            {selectedNode.operatorInterpretation?.trim() ? (
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, opacity: 0.92 }} aria-label="Selection interpretation">
                <span style={{ fontWeight: 700 }}>Readout · </span>
                {selectedNode.operatorInterpretation}
              </div>
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
            <TechnicalIdCollapsible nodeId={selectedNode.nodeId} />
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
        <h3 style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--text-h)' }}>Plan narrative</h3>
        {analysis.planStory?.planOverview ? (
          <div className="pqat-storyLane pqat-storyLane--orientation">
            <div className="pqat-storyLane__eyebrow">{storyLbl.orientation}</div>
            <div className="pqat-storyLane__body">{analysis.planStory.planOverview}</div>
          </div>
        ) : null}
        <div className="pqat-storyLane pqat-storyLane--pressure">
          <div className="pqat-storyLane__eyebrow">What happened (clamped)</div>
          <div
            className="pqat-storyLane__body"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              color: 'var(--text-secondary)',
            }}
          >
            {analysis.narrative.whatHappened}
          </div>
        </div>
        {analysis.planStory?.propagationBeats?.length ? (
          <div style={{ marginTop: 10 }}>
            <div className="pqat-storyLane pqat-storyLane--flow">
              <div className="pqat-storyLane__eyebrow">{storyLbl.flow}</div>
              <ul style={{ margin: 0, padding: 0 }}>
                {analysis.planStory.propagationBeats.map((raw, i) => {
                  const b = normalizeStoryPropagationBeat(raw)
                  return (
                    <li key={`flow-${i}`} className="pqat-storyBeatRow" style={{ paddingLeft: 10, marginBottom: 8 }}>
                      <div className="pqat-storyBeatRow__text">{b.text}</div>
                      {b.focusNodeId ? (
                        <button
                          type="button"
                          className="pqat-btn pqat-btn--sm pqat-btn--ghost"
                          onClick={() => jumpToNodeId(b.focusNodeId!)}
                          style={{ marginTop: 6 }}
                        >
                          Focus {b.anchorLabel?.trim() ? `· ${b.anchorLabel}` : 'operator'}
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        ) : null}
      </>
    ),
    mainBottlenecks: (() => {
      const bn = bottlenecksForSummary(analysis.summary.bottlenecks)
      if (!bn.length) {
        return (
          <>
            <h3 style={{ fontSize: 13, margin: '14px 0 6px' }}>Main bottlenecks</h3>
            <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
              No prioritized bottleneck list for this snapshot (often missing ANALYZE timing). Hotspots and findings still apply.
            </div>
          </>
        )
      }
      return (
        <>
          <h3 style={{ fontSize: 13, margin: '14px 0 8px', color: 'var(--text-h)' }}>Main bottlenecks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bn.map((b) => {
              const anchor = b.nodeIds[0]
              return (
                <div key={b.insightId} className="pqat-bottleneckCard" aria-label={`Bottleneck ${b.rank}: ${b.headline}`}>
                  <div className="pqat-bottleneckCard__chips">
                    <span className="pqat-bottleneckChip">#{b.rank}</span>
                    <span className="pqat-bottleneckChip pqat-bottleneckChip--class">{bottleneckClassShortLabel(b.bottleneckClass)}</span>
                    <span className="pqat-bottleneckChip">{bottleneckKindShortLabel(b.kind)}</span>
                    {bottleneckCauseHintLine(b.causeHint) ? (
                      <span className="pqat-bottleneckChip pqat-bottleneckChip--cause">{bottleneckCauseHintLine(b.causeHint)}</span>
                    ) : null}
                  </div>
                  <div className="pqat-bottleneckCard__headline">{b.headline}</div>
                  <div className="pqat-bottleneckCard__detail">{b.detail}</div>
                  {b.operatorBriefingLine?.trim() ? (
                    <div className="pqat-bottleneckCard__briefing" aria-label="Operator briefing">
                      <span className="pqat-bottleneckCard__briefingKicker">Briefing</span>
                      {b.operatorBriefingLine}
                    </div>
                  ) : null}
                  {b.symptomNote ? <div className="pqat-bottleneckCard__symptom">{b.symptomNote}</div> : null}
                  {b.propagationNote?.trim() ? <div className="pqat-bottleneckCard__propagation">{b.propagationNote}</div> : null}
                  {anchor ? (
                    <button
                      type="button"
                      className="pqat-btn pqat-btn--sm pqat-btn--ghost"
                      onClick={() => jumpToNodeId(anchor)}
                      style={{ marginTop: 8 }}
                    >
                      {b.humanAnchorLabel?.trim()
                        ? `Focus · ${b.humanAnchorLabel.length > 72 ? `${b.humanAnchorLabel.slice(0, 71)}…` : b.humanAnchorLabel}`
                        : 'Focus operator'}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )
    })(),
    hotspots: (
      <>
        <h3 style={{ fontSize: 13, margin: '14px 0 8px', color: 'var(--text-h)' }}>Where to inspect next</h3>
        {analysis.planStory?.inspectFirstPath?.trim() ? (
          <div className="pqat-storyLane pqat-storyLane--action" style={{ marginBottom: 10 }}>
            <div className="pqat-storyLane__eyebrow">{storyLbl.startHere}</div>
            <div className="pqat-storyLane__body">{analysis.planStory.inspectFirstPath}</div>
          </div>
        ) : null}
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
              ? 'Summary referenced hotspots that did not resolve in the current node list—try reloading the analysis.'
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
