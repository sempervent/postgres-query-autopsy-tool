import type { AnalysisFinding } from '../../api/types'
import {
  ariaLabelFullWriteUpInRankedList,
  ariaLabelOpenStrongestInRankedList,
  evidenceNavCopy,
  maxSeverityInFindings,
  severityChipClass,
  severityLabel,
} from '../../presentation/localEvidencePresentation'

/**
 * Compact line when the full `AnalyzeLocalFindingsShelf` already appears in Plan workspace —
 * avoids duplicating preview cards in the selected-node column.
 */
export function AnalyzeLocalFindingsBridge(props: {
  findings: AnalysisFinding[]
  onSeeInRankedList: (findingId: string) => void
}) {
  const { findings, onSeeInRankedList } = props
  const n = findings.length

  if (n === 0) {
    return (
      <p className="pqat-hint pqat-hint--tight pqat-localEvidenceBridge--empty" data-testid="analyze-local-evidence-bridge-empty" style={{ marginTop: 12 }}>
        Nothing in Ranked cites this operator.
      </p>
    )
  }

  const top = findings[0]!
  const maxSev = maxSeverityInFindings(findings)

  if (n === 1) {
    return (
      <div
        className="pqat-localEvidenceBridge pqat-localEvidenceBridge--single"
        data-testid="analyze-local-evidence-bridge"
        role="group"
        aria-label="Optional full write-up in Ranked list"
      >
        <p className="pqat-hint pqat-hint--tight" style={{ margin: 0 }}>
          The plan band above states the issue; Ranked has the full write-up and controls.
        </p>
        <button
          type="button"
          className="pqat-btn pqat-btn--ghost pqat-btn--sm"
          data-testid="analyze-local-evidence-open-top-in-list"
          aria-label={ariaLabelFullWriteUpInRankedList(top.title)}
          onClick={() => onSeeInRankedList(top.findingId)}
        >
          {evidenceNavCopy.fullWriteUpInRanked}
        </button>
      </div>
    )
  }

  return (
    <div
      className="pqat-localEvidenceBridge"
      data-testid="analyze-local-evidence-bridge"
      role="group"
      aria-label="Optional depth in Ranked findings list"
    >
      <div className="pqat-localEvidenceBridge__row">
        <span className={severityChipClass(maxSev)} title="Highest severity among findings citing this operator">
          Up to {severityLabel(maxSev)}
        </span>
        <span className="pqat-localEvidenceBridge__text">
          {n} issues cite this operator — Ranked lists them in score order (strongest matches the plan band above).
        </span>
      </div>
      <div className="pqat-localEvidenceBridge__actions">
        <button
          type="button"
          className="pqat-btn pqat-btn--ghost pqat-btn--sm"
          data-testid="analyze-local-evidence-open-top-in-list"
          aria-label={ariaLabelOpenStrongestInRankedList(top.title)}
          onClick={() => onSeeInRankedList(top.findingId)}
        >
          {evidenceNavCopy.openStrongestWriteUpInRanked}
        </button>
      </div>
    </div>
  )
}
