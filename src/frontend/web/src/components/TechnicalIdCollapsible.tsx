/** Collapsed canonical planner id for experts; kept out of primary narrative flow (Phase 62). */
export function TechnicalIdCollapsible(props: { nodeId: string; className?: string }) {
  const { nodeId, className } = props
  if (!nodeId.trim()) return null
  return (
    <details className={['pqat-technicalId', className].filter(Boolean).join(' ')}>
      <summary className="pqat-technicalId__summary">Technical id</summary>
      <code className="pqat-technicalId__code">{nodeId}</code>
    </details>
  )
}

export function TechnicalPairIdsCollapsible(props: { nodeIdA: string; nodeIdB: string; className?: string }) {
  const { nodeIdA, nodeIdB, className } = props
  return (
    <details className={['pqat-technicalId', className].filter(Boolean).join(' ')}>
      <summary className="pqat-technicalId__summary">Technical pair ids</summary>
      <div className="pqat-technicalId__pairGrid">
        <div>
          <span className="pqat-technicalId__pairLbl">Plan A</span>
          <code className="pqat-technicalId__code">{nodeIdA}</code>
        </div>
        <div>
          <span className="pqat-technicalId__pairLbl">Plan B</span>
          <code className="pqat-technicalId__code">{nodeIdB}</code>
        </div>
      </div>
    </details>
  )
}
