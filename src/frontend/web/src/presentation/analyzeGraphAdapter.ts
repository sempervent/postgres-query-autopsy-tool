import dagre from '@dagrejs/dagre'
import type { Edge, Node } from 'reactflow'
import type { AnalyzedPlanNode, PlanAnalysisResult } from '../api/types'
import { nodeShortLabel } from './nodeLabels'
import { nearestMeaningfulAncestorSubtitle } from './nodeReferences'

export type AnalyzeGraphNodeData = {
  nodeId: string
  label: string
  searchText?: string
  refSubtitle?: string | null
  kindChips: string[]
  isHotExclusive: boolean
  isHotSubtree: boolean
  isHotReads: boolean
  findingsCount: number
  severityMax: number | null
}

export type AnalyzeGraph = {
  nodes: Node<AnalyzeGraphNodeData>[]
  edges: Edge[]
}

function asNum(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

export function buildAnalyzeGraph(analysis: PlanAnalysisResult): AnalyzeGraph {
  const byId = new Map<string, AnalyzedPlanNode>(analysis.nodes.map((n) => [n.nodeId, n]))

  const hotExclusive = new Set(analysis.summary.topExclusiveTimeHotspotNodeIds ?? [])
  const hotSubtree = new Set(analysis.summary.topInclusiveTimeHotspotNodeIds ?? [])
  const hotReads = new Set(analysis.summary.topSharedReadHotspotNodeIds ?? [])

  const findingsByNode = new Map<string, { count: number; maxSev: number | null }>()
  for (const f of analysis.findings ?? []) {
    for (const id of f.nodeIds ?? []) {
      const cur = findingsByNode.get(id) ?? { count: 0, maxSev: null }
      cur.count += 1
      cur.maxSev = cur.maxSev == null ? f.severity : Math.max(cur.maxSev, f.severity)
      findingsByNode.set(id, cur)
    }
  }

  const rfNodes: Node<AnalyzeGraphNodeData>[] = []
  const rfEdges: Edge[] = []

  for (const n of analysis.nodes) {
    const label = nodeShortLabel(n, byId)
    const m: any = n.metrics as any
    const node: any = n.node as any
    const op = String(node?.nodeType ?? '')
    const rel = String(node?.relationName ?? '')
    const idx = String(node?.indexName ?? '')

    const msEx = asNum(m?.exclusiveActualTimeMsApprox)
    const reads = asNum(node?.sharedReadBlocks)
    const share = asNum(m?.subtreeTimeShare)

    const chips: string[] = []
    if (msEx != null) chips.push(`${msEx.toFixed(0)}ms ex`)
    if (share != null) chips.push(`${(share * 100).toFixed(0)}%`)
    if (reads != null) chips.push(`${reads.toFixed(0)} reads`)

    const fx = findingsByNode.get(n.nodeId) ?? { count: 0, maxSev: null }
    if (fx.count > 0) chips.push(`${fx.count} finding${fx.count === 1 ? '' : 's'}`)

    rfNodes.push({
      id: n.nodeId,
      type: 'analyzePlanNode',
      position: { x: 0, y: 0 },
      data: {
        nodeId: n.nodeId,
        label,
        searchText: [op, rel, idx].filter(Boolean).join(' '),
        refSubtitle: nearestMeaningfulAncestorSubtitle(n.nodeId, byId),
        kindChips: chips.slice(0, 3),
        isHotExclusive: hotExclusive.has(n.nodeId),
        isHotSubtree: hotSubtree.has(n.nodeId),
        isHotReads: hotReads.has(n.nodeId),
        findingsCount: fx.count,
        severityMax: fx.maxSev,
      },
    })

    for (const c of n.childNodeIds ?? []) {
      if (byId.has(c)) {
        rfEdges.push({
          id: `${n.nodeId}->${c}`,
          source: n.nodeId,
          target: c,
          type: 'smoothstep',
        })
      }
    }
  }

  return layoutTopDown(rfNodes, rfEdges)
}

function layoutTopDown(nodes: Node<AnalyzeGraphNodeData>[], edges: Edge[]): AnalyzeGraph {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  const w = 260
  const h = 74
  for (const n of nodes) g.setNode(n.id, { width: w, height: h })
  for (const e of edges) g.setEdge(e.source, e.target)

  dagre.layout(g)

  const outNodes = nodes.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - w / 2, y: p.y - h / 2 } }
  })

  return { nodes: outNodes, edges }
}

