/** Build a copy-paste EXPLAIN wrapper for the user's query text (no SQL parsing). */

export type ExplainCommandBuilderOptions = {
  analyze: boolean
  verbose: boolean
  buffers: boolean
  costs: boolean
}

export function buildSuggestedExplainSql(
  queryText: string,
  opts: ExplainCommandBuilderOptions,
): string | null {
  const q = queryText.trim()
  if (!q) return null
  const body = q.replace(/;+\s*$/u, '')
  const parts: string[] = []
  if (opts.analyze) parts.push('ANALYZE')
  if (opts.verbose) parts.push('VERBOSE')
  if (opts.buffers) parts.push('BUFFERS')
  parts.push(opts.costs ? 'COSTS true' : 'COSTS false')
  parts.push('FORMAT JSON')
  return `EXPLAIN (${parts.join(', ')})\n${body};`
}
