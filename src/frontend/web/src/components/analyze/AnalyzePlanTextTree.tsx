import type { AnalyzedPlanNode } from '../../api/types'

export function AnalyzePlanTextTree(props: {
  rootId: string
  byId: Map<string, AnalyzedPlanNode>
  childrenById: Map<string, string[]>
  selectedNodeId: string | null
  setSelectedNodeId: (id: string) => void
  nodeSearch: string
  nodeLabel: (n: AnalyzedPlanNode) => string
}) {
  const { byId, childrenById, selectedNodeId, setSelectedNodeId, nodeSearch, nodeLabel } = props

  function matchesNodeSearch(n: AnalyzedPlanNode) {
    const q = nodeSearch.trim().toLowerCase()
    if (!q) return true
    const t = String((n.node as any)?.nodeType ?? '').toLowerCase()
    const rel = String((n.node as any)?.relationName ?? '').toLowerCase()
    const idx = String((n.node as any)?.indexName ?? '').toLowerCase()
    return t.includes(q) || rel.includes(q) || idx.includes(q)
  }

  function TreeNode({ nodeId }: { nodeId: string }) {
    const node = byId.get(nodeId)
    if (!node) return null

    if (!matchesNodeSearch(node)) {
      const kids = childrenById.get(nodeId) ?? []
      const anyDesc = kids.some((k) => {
        const child = byId.get(k)
        return child ? matchesNodeSearch(child) : false
      })
      if (!anyDesc) return null
    }

    const kids = childrenById.get(nodeId) ?? []

    return (
      <div style={{ marginLeft: 12, borderLeft: '1px solid var(--border)', paddingLeft: 10, marginTop: 6 }}>
        <button
          onClick={() => setSelectedNodeId(nodeId)}
          style={{
            display: 'flex',
            width: '100%',
            textAlign: 'left',
            gap: 8,
            alignItems: 'center',
            padding: '6px 8px',
            borderRadius: 10,
            border: selectedNodeId === nodeId ? '1px solid var(--accent-border)' : '1px solid transparent',
            background: selectedNodeId === nodeId ? 'var(--accent-bg)' : 'transparent',
            color: 'var(--text-h)',
            cursor: 'pointer',
            fontFamily: 'var(--mono)',
            fontSize: 12,
          }}
        >
          <span style={{ opacity: 0.8, fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)' }}>
            {String((node.node as any)?.nodeType ?? 'Unknown')}
          </span>
          <span style={{ fontFamily: 'var(--mono)' }}>{nodeLabel(node)}</span>
        </button>
        {kids.length > 0 ? kids.map((k) => <TreeNode key={k} nodeId={k} />) : null}
      </div>
    )
  }

  return <TreeNode nodeId={props.rootId} />
}
