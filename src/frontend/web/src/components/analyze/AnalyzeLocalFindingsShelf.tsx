import { useId } from 'react'
import type { AnalysisFinding } from '../../api/types'
import {
  ariaLabelFullWriteUpInRankedList,
  evidenceNavCopy,
  severityChipClass,
  severityLabel,
} from '../../presentation/localEvidencePresentation'

function truncateText(s: string, max: number) {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

const PREVIEW_COUNT = 2

export function AnalyzeLocalFindingsShelf(props: {
  findings: AnalysisFinding[]
  onSeeInRankedList: (findingId: string) => void
  /** Workspace strip under the graph vs selected-node column (full shelf when workspace hidden). */
  variant: 'workspace' | 'detail'
  testId?: string
  /**
   * Phase 137: under-graph previews stay optional after the issue summary — shorter copy, no “strongest” badge,
   * demoted Ranked CTAs, and (single-finding) no repeated summary paragraph.
   */
  compactWorkspacePreview?: boolean
}) {
  const { findings, onSeeInRankedList, variant, testId = 'analyze-local-findings-shelf', compactWorkspacePreview = false } = props
  const headingId = useId()
  const liveId = useId()

  const top = findings.slice(0, PREVIEW_COUNT)
  const rest = findings.slice(PREVIEW_COUNT)
  const compact = compactWorkspacePreview && variant === 'workspace'
  const omitLeadSummary = compact && findings.length === 1
  const shellClass =
    variant === 'workspace'
      ? 'pqat-graphLocalFindingsShelf pqat-graphLocalFindingsShelf--workspace'
      : 'pqat-graphLocalFindingsShelf pqat-graphLocalFindingsShelf--detail'

  if (!findings.length) {
    return (
      <div className={shellClass} data-testid={testId}>
        <p className="pqat-hint pqat-hint--tight pqat-graphLocalFindingsShelf--empty" data-testid={`${testId}-empty`} style={{ margin: 0 }}>
          No ranked findings cite this operator.
        </p>
      </div>
    )
  }

  return (
    <section className={shellClass} data-testid={testId} role="region" aria-labelledby={headingId}>
      <span id={liveId} className="pqat-srOnly" aria-live="polite" aria-atomic="true">
        {findings.length} related finding{findings.length === 1 ? '' : 's'} for this operator.
      </span>
      <h3 className="pqat-graphLocalFindingsShelf__title" id={headingId}>
        {compact ? 'More in Ranked' : 'Why this operator matters'}
      </h3>
      <ol className="pqat-graphLocalFindingsShelf__list" aria-label="Preview of ranked findings for this operator">
        {top.map((f, i) => (
          <li
            key={f.findingId}
            className={`pqat-localFindingPreview${i === 0 ? ' pqat-localFindingPreview--lead' : ' pqat-localFindingPreview--secondary'}`}
            data-pqat-preview-finding-id={f.findingId}
          >
            {i === 0 && !compact ? <div className="pqat-localFindingPreview__badge">Strongest match</div> : null}
            <div className="pqat-localFindingPreview__head">
              <span className={severityChipClass(f.severity)}>{severityLabel(f.severity)}</span>
              <span className="pqat-localFindingPreview__title">
                {truncateText(f.title, compact ? (i === 0 ? 72 : 56) : i === 0 ? 80 : 64)}
              </span>
            </div>
            {!(omitLeadSummary && i === 0) ? (
              <p className="pqat-localFindingPreview__summary">
                {truncateText(f.summary, compact ? (i === 0 ? 100 : 80) : i === 0 ? 180 : 120)}
              </p>
            ) : null}
            <button
              type="button"
              className="pqat-btn pqat-btn--ghost pqat-btn--sm"
              data-testid={`${testId}-see-${f.findingId}`}
              aria-label={ariaLabelFullWriteUpInRankedList(f.title)}
              onClick={() => onSeeInRankedList(f.findingId)}
            >
              {compact ? evidenceNavCopy.fullWriteUpInRanked : evidenceNavCopy.openInRankedList}
            </button>
          </li>
        ))}
      </ol>
      {findings.length > PREVIEW_COUNT ? (
        <p className="pqat-graphLocalFindingsShelf__truncationCue" data-testid="analyze-local-evidence-truncation-cue">
          {compact ? (
            <>
              Showing {PREVIEW_COUNT} of {findings.length} · +{rest.length} more titles in Ranked.
            </>
          ) : (
            <>
              <strong>Previews</strong> {PREVIEW_COUNT} of {findings.length} · +{rest.length} under <strong>Other titles</strong>
              <span className="pqat-graphLocalFindingsShelf__truncationCueHint"> · Full rows stay in Ranked.</span>
            </>
          )}
        </p>
      ) : null}
      {rest.length > 0 ? (
        <details className="pqat-graphLocalFindingsShelf__more">
          <summary data-testid="analyze-local-evidence-other-titles-summary">Other titles ({rest.length})</summary>
          <ul className="pqat-graphLocalFindingsShelf__moreList">
            {rest.map((f) => (
              <li key={f.findingId}>
                <button
                  type="button"
                  className="pqat-graphLocalFindingsShelf__moreLink"
                  data-testid={`${testId}-see-${f.findingId}`}
                  aria-label={ariaLabelFullWriteUpInRankedList(f.title)}
                  onClick={() => onSeeInRankedList(f.findingId)}
                >
                  {truncateText(f.title, 64)}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
