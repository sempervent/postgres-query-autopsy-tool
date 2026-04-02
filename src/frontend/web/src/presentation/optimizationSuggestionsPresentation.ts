/** Labels for API string enums (Phase 32). */
export function optimizationCategoryLabel(c: string): string {
  const m: Record<string, string> = {
    index_experiment: 'Index experiment',
    query_rewrite: 'Query rewrite',
    schema_change: 'Schema',
    statistics_maintenance: 'Statistics',
    partitioning_chunking: 'Partition / chunk',
    sort_ordering: 'Sort / order',
    join_strategy: 'Join strategy',
    parallelism: 'Parallelism',
    timescaledb_workload: 'Timescale / chunks',
    observe_before_change: 'Observe / validate',
  }
  return m[c] ?? c.replace(/_/g, ' ')
}

export function suggestionConfidenceLabel(c: string): string {
  if (c === 'high') return 'Confidence: high'
  if (c === 'low') return 'Confidence: low'
  return 'Confidence: medium'
}

export function suggestionPriorityLabel(p: string): string {
  if (p === 'critical') return 'Priority: critical'
  if (p === 'high') return 'Priority: high'
  if (p === 'low') return 'Priority: low'
  return 'Priority: medium'
}

const priorityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export function compareSuggestionsByPriority(a: { priority?: string }, b: { priority?: string }): number {
  return (priorityRank[b.priority ?? ''] ?? 0) - (priorityRank[a.priority ?? ''] ?? 0)
}
