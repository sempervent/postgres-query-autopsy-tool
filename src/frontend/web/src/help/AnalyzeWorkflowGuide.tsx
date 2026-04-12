import type { ReactNode } from 'react'
import { WorkflowGuideCopyGuidedRow } from './WorkflowGuideCopyGuidedRow'
import { WorkflowGuideShell } from './WorkflowGuideShell'
import { ANALYZE_WORKFLOW_GUIDE_TITLE_ID } from './workflowGuideDomIds'

export function AnalyzeWorkflowGuide(props: {
  panelId?: string
  testId?: string
  keyboardContain?: boolean
  /** Phase 107: same Try-example chips as capture (optional). */
  examplePicker?: ReactNode
}) {
  const { panelId, testId, keyboardContain, examplePicker } = props
  return (
    <WorkflowGuideShell
      panelId={panelId}
      testId={testId}
      keyboardContain={keyboardContain}
      titleId={ANALYZE_WORKFLOW_GUIDE_TITLE_ID}
      title="Analyze a plan"
      lede="Paste a PostgreSQL plan JSON. The app ranks findings and gives you a graph-first workspace—use the top summary to triage before you read everything."
      footer={<WorkflowGuideCopyGuidedRow testId="analyze-workflow-guide-copy-guided" />}
    >
      {examplePicker ? (
        <section className="pqat-help-section" aria-labelledby={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-examples`}>
          <h3 className="pqat-help-section__title" id={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-examples`}>
            Sample plans
          </h3>
          <p className="pqat-help-section__body" style={{ marginBottom: 0 }}>
            Fastest start: tap a sample—each shows a different shape (scan, sort pressure, index ordering).
          </p>
          <div data-testid="analyze-guide-example-entry">{examplePicker}</div>
        </section>
      ) : null}
      <section className="pqat-help-section" aria-labelledby={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-paste`}>
        <h3 className="pqat-help-section__title" id={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-paste`}>
          What to paste
        </h3>
        <ul className="pqat-help-section__body">
          <li>
            Best: <code>EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)</code> output—plain JSON or a <code>psql</code>{' '}
            <code>QUERY PLAN</code> cell (including wrapped lines ending in <code>+</code>).
          </li>
          <li>
            Optional source SQL and EXPLAIN options help exports and tickets; they do not change how the tree is parsed.
          </li>
        </ul>
      </section>
      <section className="pqat-help-section" aria-labelledby={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-surfaces`}>
        <h3 className="pqat-help-section__title" id={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-surfaces`}>
          What you are looking at
        </h3>
        <ul className="pqat-help-section__body">
          <li>
            <strong>Graph</strong> for structure and hotspots; <strong>Text</strong> for the same tree in outline form. Click a node to anchor the rest of the page.
          </li>
          <li>
            <strong>Plan guide</strong> (when open) summarizes the selected operator—still interpretation on top of raw plan data.
          </li>
          <li>
            <strong>Findings</strong> are ranked signals with evidence. <strong>Suggestions</strong> group overlapping hints into practical next checks.
          </li>
        </ul>
      </section>
      <section className="pqat-help-section" aria-labelledby={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-read`}>
        <h3 className="pqat-help-section__title" id={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-read`}>
          How to read results
        </h3>
        <ul className="pqat-help-section__body">
          <li>
            Read the <strong>Start here</strong> band and <strong>Also scan</strong> first—then click through to the graph.
          </li>
          <li>
            <strong>Bottlenecks</strong> show where time or reads pile up—pointers for investigation, not guaranteed root cause.
          </li>
          <li>
            Use <strong>Copy</strong> on nodes, findings, and suggestions for tickets—re-run the same <code>EXPLAIN</code> on your database to verify.
          </li>
        </ul>
      </section>
    </WorkflowGuideShell>
  )
}
