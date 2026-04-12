import type { ReactNode } from 'react'
import { WorkflowGuideCopyGuidedRow } from './WorkflowGuideCopyGuidedRow'
import { WorkflowGuideShell } from './WorkflowGuideShell'
import { COMPARE_WORKFLOW_GUIDE_TITLE_ID } from './workflowGuideDomIds'

export function CompareWorkflowGuide(props: {
  panelId?: string
  testId?: string
  keyboardContain?: boolean
  examplePicker?: ReactNode
}) {
  const { panelId, testId, keyboardContain, examplePicker } = props
  return (
    <WorkflowGuideShell
      panelId={panelId}
      testId={testId}
      keyboardContain={keyboardContain}
      titleId={COMPARE_WORKFLOW_GUIDE_TITLE_ID}
      title="Compare plans"
      lede="Paste two plans from the same or a closely related query. The mapper aligns operators heuristically—start from the summary takeaway, then open pairs the UI highlights."
      footer={<WorkflowGuideCopyGuidedRow testId="compare-workflow-guide-copy-guided" />}
    >
      {examplePicker ? (
        <section className="pqat-help-section" aria-labelledby={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-examples`}>
          <h3 className="pqat-help-section__title" id={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-examples`}>
            Sample pairs
          </h3>
          <p className="pqat-help-section__body" style={{ marginBottom: 0 }}>
            Fastest start: try both samples—seq→index rewrites vs bitmap→index access paths.
          </p>
          <div data-testid="compare-guide-example-entry">{examplePicker}</div>
        </section>
      ) : null}
      <section className="pqat-help-section" aria-labelledby={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-input`}>
        <h3 className="pqat-help-section__title" id={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-input`}>
          What to compare
        </h3>
        <ul className="pqat-help-section__body">
          <li>
            Plan <strong>A</strong> = baseline, Plan <strong>B</strong> = candidate. Use the same <code>EXPLAIN (… FORMAT JSON)</code> style as Analyze; <code>ANALYZE</code> and{' '}
            <code>BUFFERS</code> make runtime and read deltas meaningful.
          </li>
          <li>
            If mapping is uncertain, the UI says so—use unmatched lists and confidence readouts before acting.
          </li>
        </ul>
      </section>
      <section className="pqat-help-section" aria-labelledby={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-columns`}>
        <h3 className="pqat-help-section__title" id={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-columns`}>
          Main columns
        </h3>
        <ul className="pqat-help-section__body">
          <li>
            <strong>Change briefing</strong> lines summarize each side of the selected pair in plain language.
          </li>
          <li>
            <strong>Index changes</strong> track posture and bounded index insight diffs (new, resolved, or shifted behavior).
          </li>
          <li>
            <strong>Next steps</strong> (compare suggestions) are prioritized follow-ups—verify on real data before shipping DDL.
          </li>
        </ul>
      </section>
      <section className="pqat-help-section" aria-labelledby={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-pins`}>
        <h3 className="pqat-help-section__title" id={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-pins`}>
          Pins, links, and copy
        </h3>
        <ul className="pqat-help-section__body">
          <li>
            Click findings, index insights, or suggestions to <strong>pin</strong> them into the URL so collaborators open the same focus.
          </li>
          <li>
            <strong>Copy link</strong> restores this saved comparison (URL + pins). <strong>Copy pin context</strong> is chat-sized text only—no URL.{' '}
            Footer <strong>Copy merged guided link</strong> / <strong>Copy entry guided link</strong> reopen help (<code>guide=1</code>)—they are not a saved comparison by themselves.
          </li>
          <li>
            Removing <code>pair=</code> from the address bar clears an explicit pair selection; the app falls back to the current navigator selection or a sensible default pair.
          </li>
        </ul>
      </section>
      <section className="pqat-help-section" aria-labelledby={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-continuity`}>
        <h3 className="pqat-help-section__title" id={`${COMPARE_WORKFLOW_GUIDE_TITLE_ID}-continuity`}>
          Continuity hints
        </h3>
        <ul className="pqat-help-section__body">
          <li>
            Hints such as “same region, strategy shift” are high-level alignment cues between matched operators—not guarantees that two plans are equivalent overall.
          </li>
        </ul>
      </section>
    </WorkflowGuideShell>
  )
}
