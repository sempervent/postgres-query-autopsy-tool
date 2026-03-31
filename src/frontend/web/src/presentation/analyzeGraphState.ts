import type { AnalyzeGraph, AnalyzeGraphNodeData } from './analyzeGraphAdapter'

export type AnalyzeGraphViewState = {
  collapsed: Set<string>
  searchTerm: string
}

export type AnalyzeGraphSearchHit = {
  nodeId: string
  label: string
  subtitle?: string | null
}

export function computeSearchHits(base: AnalyzeGraph, termRaw: string): AnalyzeGraphSearchHit[] {
  const term = termRaw.trim().toLowerCase()
  if (!term) return []

  const hits: AnalyzeGraphSearchHit[] = []

  const byId = new Map(base.nodes.map((n) => [n.id, n.data as AnalyzeGraphNodeData]))
  const parent = new Map<string, string>()
  for (const e of base.edges) parent.set(e.target, e.source)

  function depth(id: string): number {
    let d = 0
    let cur = id
    while (parent.has(cur) && d < 50) {
      cur = parent.get(cur)!
      d++
    }
    return d
  }

  function subtitleFor(id: string): string | null {
    // Prefer nearest meaningful boundary (join/aggregate/sort); fallback to parent/depth.
    let cur = id
    let steps = 0
    while (parent.has(cur) && steps < 50) {
      const p = parent.get(cur)!
      const pl = byId.get(p)?.label
      const pst = String(byId.get(p)?.searchText ?? '').toLowerCase()
      const pIsJoin = pst.includes(' join') || pst.includes('nested loop') || String(pl ?? '').toLowerCase().includes(' join') || String(pl ?? '').toLowerCase() === 'nested loop'
      const pIsBoundary = pst.includes('aggregate') || pst.includes('sort') || String(pl ?? '').toLowerCase().includes('aggregate') || String(pl ?? '').toLowerCase().includes('sort')
      if (pl && (pIsJoin || pIsBoundary)) return `under ${pl}`
      cur = p
      steps++
    }

    const p = parent.get(id)
    const dep = depth(id)
    const pl = p ? byId.get(p)?.label : null
    if (pl) return `under ${pl} · depth ${dep}`
    return dep ? `depth ${dep}` : null
  }

  for (const n of base.nodes) {
    const d = n.data
    const hay = `${d.label} ${(d.searchText ?? '')}`.toLowerCase()
    if (hay.includes(term)) hits.push({ nodeId: d.nodeId, label: d.label, subtitle: subtitleFor(d.nodeId) })
  }
  return hits
}

export function applyGraphView(base: AnalyzeGraph, state: AnalyzeGraphViewState, selectedNodeId: string | null) {
  const visible = computeVisibleNodeIds(base, state.collapsed)
  const hits = computeSearchHits(base, state.searchTerm)
  const hitSet = new Set(hits.map((h) => h.nodeId))
  const hasSearch = state.searchTerm.trim().length > 0

  const nodes = base.nodes
    .filter((n) => visible.has(n.id))
    .map((n) => {
      const d = n.data as AnalyzeGraphNodeData
      const isMatch = hasSearch ? hitSet.has(d.nodeId) : false
      const isDim = hasSearch ? !isMatch : false
      const collapsed = state.collapsed.has(d.nodeId)

      return {
        ...n,
        data: {
          ...d,
          isSearchMatch: isMatch,
          isSearchDim: isDim,
          isCollapsed: collapsed,
          isSelected: selectedNodeId === d.nodeId,
        },
      }
    })

  const edges = base.edges.filter((e) => visible.has(e.source) && visible.has(e.target))
  return { nodes, edges, hits }
}

export function toggleCollapsed(collapsed: Set<string>, nodeId: string): Set<string> {
  const next = new Set(collapsed)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  return next
}

export function revealPath(collapsed: Set<string>, base: AnalyzeGraph, targetNodeId: string): Set<string> {
  // Remove collapsed ancestors so the target becomes visible.
  const parent = new Map<string, string>()
  for (const e of base.edges) parent.set(e.target, e.source)

  const next = new Set(collapsed)
  let cur = targetNodeId
  let steps = 0
  while (parent.has(cur) && steps < 100) {
    cur = parent.get(cur)!
    next.delete(cur)
    steps++
  }
  return next
}

export function shouldAutoFitOnVisibilityChange(prevVisibleCount: number, nextVisibleCount: number): boolean {
  const diff = Math.abs(prevVisibleCount - nextVisibleCount)
  return diff >= 15
}

export function computeVisibleNodeIds(base: AnalyzeGraph, collapsed: Set<string>): Set<string> {
  const children = new Map<string, string[]>()
  for (const e of base.edges) {
    const arr = children.get(e.source) ?? []
    arr.push(e.target)
    children.set(e.source, arr)
  }

  const hidden = new Set<string>()
  const queue: string[] = []
  for (const c of collapsed) queue.push(c)

  while (queue.length) {
    const id = queue.shift()!
    const kids = children.get(id) ?? []
    for (const k of kids) {
      if (!hidden.has(k)) {
        hidden.add(k)
        queue.push(k)
      }
    }
  }

  const visible = new Set<string>()
  for (const n of base.nodes) {
    if (!hidden.has(n.id)) visible.add(n.id)
  }
  return visible
}

