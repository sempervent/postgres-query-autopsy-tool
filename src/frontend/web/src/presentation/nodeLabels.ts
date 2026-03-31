import type { AnalyzedPlanNode, NodePairDetail } from '../api/types'

type NodeCore = {
  nodeType?: string | null
  relationName?: string | null
  indexName?: string | null
  joinType?: string | null
  sortKey?: string | null
  groupKey?: string | null
  alias?: string | null
}

function core(n: AnalyzedPlanNode): NodeCore {
  const node = n.node as any
  return {
    nodeType: node?.nodeType ?? null,
    relationName: node?.relationName ?? null,
    indexName: node?.indexName ?? null,
    joinType: node?.joinType ?? null,
    sortKey: node?.sortKey ?? null,
    groupKey: node?.groupKey ?? null,
    alias: node?.alias ?? null,
  }
}

function childRelations(n: AnalyzedPlanNode, byId: Map<string, AnalyzedPlanNode>): string[] {
  const rels: string[] = []
  for (const id of n.childNodeIds ?? []) {
    const c = byId.get(id)
    if (!c) continue
    const r = (c.node as any)?.relationName
    if (typeof r === 'string' && r.trim()) rels.push(r.trim())
  }
  return Array.from(new Set(rels)).slice(0, 2)
}

function trimCond(s: string, maxLen = 80): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1)}…`
}

function joinConditionSnippet(n: AnalyzedPlanNode): string | null {
  const node = n.node as any
  const hash = node?.hashCond as string | undefined
  const merge = node?.mergeCond as string | undefined
  const jf = node?.joinFilter as string | undefined
  const cond = hash || merge || jf
  if (!cond || typeof cond !== 'string' || !cond.trim()) return null
  return trimCond(cond)
}

function firstDescendantWithRelation(nodeId: string, byId: Map<string, AnalyzedPlanNode>, maxNodes = 20): string | null {
  const queue: string[] = [nodeId]
  const seen = new Set<string>([nodeId])
  let steps = 0
  while (queue.length && steps < maxNodes) {
    const id = queue.shift()!
    const n = byId.get(id)
    if (!n) continue
    const rel = (n.node as any)?.relationName
    if (typeof rel === 'string' && rel.trim()) return rel.trim()
    for (const c of n.childNodeIds ?? []) {
      if (!seen.has(c)) {
        seen.add(c)
        queue.push(c)
      }
    }
    steps++
  }
  return null
}

export function joinLabelAndSubtitle(n: AnalyzedPlanNode, byId: Map<string, AnalyzedPlanNode>): { label: string; subtitle: string | null } | null {
  const type = String((n.node as any)?.nodeType ?? 'Unknown')
  const isHashJoin = type.toLowerCase().includes('hash join')
  const isMergeJoin = type.toLowerCase().includes('merge join')
  const isNestedLoop = type.toLowerCase() === 'nested loop'
  const isJoin = isHashJoin || isMergeJoin || isNestedLoop || type.toLowerCase().includes(' join')
  if (!isJoin) return null

  const child0 = n.childNodeIds?.[0] ?? null
  const child1 = n.childNodeIds?.[1] ?? null
  const leftRel = child0 ? firstDescendantWithRelation(child0, byId) : null
  let rightRel = child1 ? firstDescendantWithRelation(child1, byId) : null

  // Hash Join build side is often the Hash node as the right child; prefer the Hash's input relation.
  if (isHashJoin && child1) {
    const rightNode = byId.get(child1)
    const rightType = String((rightNode?.node as any)?.nodeType ?? '')
    if (rightType.toLowerCase() === 'hash') {
      const hashInput = rightNode?.childNodeIds?.[0]
      if (hashInput) rightRel = firstDescendantWithRelation(hashInput, byId) ?? rightRel
    }
  }

  const label = leftRel && rightRel ? `${type} (${leftRel} × ${rightRel})` : type

  const roleParts: string[] = []
  if (leftRel || rightRel) {
    if (isHashJoin) {
      if (rightRel) roleParts.push(`build: ${rightRel}`)
      if (leftRel) roleParts.push(`probe: ${leftRel}`)
    } else if (isNestedLoop || isMergeJoin) {
      if (leftRel) roleParts.push(`outer: ${leftRel}`)
      if (rightRel) roleParts.push(`inner: ${rightRel}`)
    } else {
      if (leftRel) roleParts.push(`left: ${leftRel}`)
      if (rightRel) roleParts.push(`right: ${rightRel}`)
    }
  }

  const cond = joinConditionSnippet(n)
  if (cond) roleParts.push(`cond: ${cond}`)

  return { label, subtitle: roleParts.length ? roleParts.join(' • ') : null }
}

export function nodeChipLabel(n: AnalyzedPlanNode): string {
  const c = core(n)
  return String(c.nodeType ?? 'Unknown')
}

export function nodeShortLabel(n: AnalyzedPlanNode, byId?: Map<string, AnalyzedPlanNode>): string {
  const c = core(n)
  const type = String(c.nodeType ?? 'Unknown')

  if (c.relationName) {
    if (c.indexName && type.toLowerCase().includes('index')) return `${type} on ${c.relationName} using ${c.indexName}`
    return `${type} on ${c.relationName}`
  }

  if (type.toLowerCase().includes('join') || type.toLowerCase() === 'nested loop') {
    if (byId) {
      const js = joinLabelAndSubtitle(n, byId)
      if (js?.label) return js.label
    }
    const rels = byId ? childRelations(n, byId) : []
    if (rels.length === 2) return `${type} (${rels[0]} × ${rels[1]})`
    if (rels.length === 1) return `${type} (${rels[0]} …)`
    if (c.joinType) return `${type} (${c.joinType})`
    return type
  }

  if (type.toLowerCase().includes('sort') && c.sortKey) return `Sort on ${c.sortKey}`
  if (type.toLowerCase().includes('aggregate') && c.groupKey) return `Aggregate by ${c.groupKey}`

  return type
}

export function pairShortLabel(pair: NodePairDetail, byIdA?: Map<string, AnalyzedPlanNode>, byIdB?: Map<string, AnalyzedPlanNode>): string {
  const aNode = byIdA?.get(pair.identity.nodeIdA)
  const bNode = byIdB?.get(pair.identity.nodeIdB)
  const aLabel = aNode ? nodeShortLabel(aNode, byIdA) : `${pair.identity.nodeTypeA}${pair.identity.relationNameA ? ` on ${pair.identity.relationNameA}` : ''}`
  const bLabel = bNode ? nodeShortLabel(bNode, byIdB) : `${pair.identity.nodeTypeB}${pair.identity.relationNameB ? ` on ${pair.identity.relationNameB}` : ''}`
  return `${aLabel} → ${bLabel}`
}

export function findingAnchorLabel(nodeId: string | null | undefined, byId: Map<string, AnalyzedPlanNode>): string {
  if (!nodeId) return 'Unknown operator'
  const n = byId.get(nodeId)
  if (!n) return 'Unknown operator'
  return nodeShortLabel(n, byId)
}

