import { WorkflowGuideCopyGuidedRow } from './WorkflowGuideCopyGuidedRow'
import { WorkflowGuideShell } from './WorkflowGuideShell'
import { ANALYZE_WORKFLOW_GUIDE_TITLE_ID } from './workflowGuideDomIds'

export function AnalyzeWorkflowGuide(props: { panelId?: string; testId?: string; keyboardContain?: boolean }) {
  const { panelId, testId, keyboardContain } = props
  return (
    <WorkflowGuideShell
      panelId={panelId}
      testId={testId}
      keyboardContain={keyboardContain}
      titleId={ANALYZE_WORKFLOW_GUIDE_TITLE_ID}
      title="Analyze a plan"
      lede="Paste one PostgreSQL execution plan. The app normalizes it, ranks evidence-backed findings, and gives you a workspace to explore—not a single verdict you should trust blindly."
      footer={<WorkflowGuideCopyGuidedRow testId="analyze-workflow-guide-copy-guided" />}
    >
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
            <strong>Graph</strong> shows structure and hotspots; <strong>Text</strong> is the same tree in outline form. Click nodes to anchor everything else.
          </li>
          <li>
            The <strong>Plan guide</strong> (when visible) summarizes the story for your current selection—still interpretation layered on raw plan data.
          </li>
          <li>
            <strong>Findings</strong> are ranked signals with evidence. <strong>Optimization suggestions</strong> merge overlapping hints into practical next checks.
          </li>
        </ul>
      </section>
      <section className="pqat-help-section" aria-labelledby={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-read`}>
        <h3 className="pqat-help-section__title" id={`${ANALYZE_WORKFLOW_GUIDE_TITLE_ID}-read`}>
          How to read results
        </h3>
        <ul className="pqat-help-section__body">
          <li>
            Start with summary and top findings, then jump into the graph for the nodes they mention.
          </li>
          <li>
            <strong>Bottlenecks</strong> highlight where time or reads concentrate; treat them as pointers, not proof of root cause.
          </li>
          <li>
            Use <strong>Copy</strong> actions on nodes, findings, and suggestions when you file tickets—always re-run the same <code>EXPLAIN</code> on your cluster to verify.
          </li>
        </ul>
      </section>
    </WorkflowGuideShell>
  )
}
