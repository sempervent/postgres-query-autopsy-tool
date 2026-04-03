import type { ExplainCaptureMetadata, PlannerCostPresence } from '../api/types'

export function plannerCostsLabel(p: PlannerCostPresence | string | undefined | null): string {
  switch (p) {
    case 'present':
      return 'Planner costs: present in JSON (startup/total cost or plan rows/width)'
    case 'notDetected':
      return 'Planner costs: not detected (often EXPLAIN with COSTS OFF or stripped JSON)'
    case 'mixed':
      return 'Planner costs: mixed across nodes — interpret cost cues cautiously'
    case 'unknown':
    default:
      return 'Planner costs: unknown (no nodes to inspect)'
  }
}

export function formatDeclaredExplainOptionsLine(meta: ExplainCaptureMetadata | null | undefined): string | null {
  const o = meta?.options
  if (!o) return null
  const parts: string[] = []
  if (o.format?.trim()) parts.push(`FORMAT ${o.format.trim()}`)
  if (o.analyze === true) parts.push('ANALYZE')
  if (o.verbose === true) parts.push('VERBOSE')
  if (o.buffers === true) parts.push('BUFFERS')
  if (o.costs === true) parts.push('COSTS on')
  if (o.costs === false) parts.push('COSTS off')
  if (o.settings === true) parts.push('SETTINGS')
  if (o.wal === true) parts.push('WAL')
  if (o.timing === true) parts.push('TIMING')
  if (o.summary === true) parts.push('SUMMARY')
  if (o.jit === true) parts.push('JIT')
  return parts.length ? parts.join(', ') : null
}
