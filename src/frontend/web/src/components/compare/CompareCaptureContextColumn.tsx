import type { PlanAnalysisResult } from '../../api/types'
import { formatDeclaredExplainOptionsLine, plannerCostsLabel } from '../../presentation/explainMetadataPresentation'

export function CompareCaptureContextColumn({ title, plan }: { title: string; plan: PlanAnalysisResult }) {
  const optLine = formatDeclaredExplainOptionsLine(plan.explainMetadata ?? null)
  const norm = plan.planInputNormalization
  return (
    <div style={{ padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
        <li>Source query: {plan.queryText?.trim() ? 'provided' : 'not provided'}</li>
        <li>{plannerCostsLabel(plan.summary.plannerCosts)}</li>
        <li>
          Input normalization:{' '}
          {!norm
            ? 'not recorded'
            : norm.kind === 'rawJson'
              ? 'Parsed raw JSON directly'
              : norm.kind === 'queryPlanTable'
                ? 'Normalized QUERY PLAN output'
                : norm.kind}
        </li>
        {optLine ? <li>Declared options (client): {optLine}</li> : <li>No declared EXPLAIN options in payload.</li>}
        {plan.explainMetadata?.sourceExplainCommand?.trim() ? (
          <li style={{ marginTop: 6 }}>
            <span style={{ opacity: 0.85 }}>Recorded command</span>
            <pre style={{ margin: '4px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)' }}>
              {plan.explainMetadata.sourceExplainCommand.trim()}
            </pre>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
