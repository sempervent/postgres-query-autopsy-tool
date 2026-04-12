import { useId } from 'react'
import type { AnalysisFinding } from '../../api/types'
import { buildGraphNodeIssueSummary } from '../../presentation/graphNodeIssueSummaryPresentation'
import { severityChipClass, severityLabel } from '../../presentation/localEvidencePresentation'

/**
 * Phase 137: compact “read the problem here first” band under the graph — before the preview shelf.
 */
export function AnalyzeGraphIssueSummary(props: {
  findingsForSelectedNode: AnalysisFinding[]
  /** Plain operator label for the region subtitle (no internal ids). */
  operatorLabel: string | null
}) {
  const { findingsForSelectedNode, operatorLabel } = props
  const titleId = useId()
  const model = buildGraphNodeIssueSummary(findingsForSelectedNode)

  if (findingsForSelectedNode.length === 0) {
    return (
      <section
        className="pqat-graphIssueSummary pqat-graphIssueSummary--empty"
        data-testid="analyze-graph-issue-summary"
        aria-labelledby={titleId}
      >
        <div className="pqat-graphIssueSummary__eyebrow" id={titleId}>
          What looks wrong here
        </div>
        <p className="pqat-graphIssueSummary__emptyBody">
          No ranked findings cite this operator{operatorLabel ? ` (${operatorLabel})` : ''}. Try another node, or use
          Ranked for the triage deck.
        </p>
      </section>
    )
  }

  if (!model) return null

  return (
    <section
      className="pqat-graphIssueSummary"
      data-testid="analyze-graph-issue-summary"
      aria-labelledby={titleId}
    >
      <div className="pqat-graphIssueSummary__eyebrow" id={titleId}>
        What looks wrong here
      </div>
      {operatorLabel ? (
        <p className="pqat-graphIssueSummary__context pqat-hint pqat-hint--tight">{operatorLabel}</p>
      ) : null}
      <div className="pqat-graphIssueSummary__problem">
        <span className={severityChipClass(model.severity)}>{severityLabel(model.severity)}</span>
        <span className="pqat-graphIssueSummary__title">{model.problemTitle}</span>
      </div>
      <p className="pqat-graphIssueSummary__why">Why it matters: {model.whyMatters}</p>
      <p className="pqat-graphIssueSummary__next pqat-hint pqat-hint--tight">{model.inspectNextLine}</p>
    </section>
  )
}
