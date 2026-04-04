/** Up to three human-readable metric lines for the Plan guide selection snapshot. */
export function compactMetricsPreview(metrics: Record<string, unknown>): string[] {
  const keys = [
    'exclusiveActualTimeMs',
    'inclusiveActualTimeMs',
    'actualTotalTimeMs',
    'actualRows',
    'planRows',
    'rowEstimateDivergenceRatio',
    'actualLoops',
  ]
  const lines: string[] = []
  for (const k of keys) {
    if (k in metrics && metrics[k] != null && metrics[k] !== '')
      lines.push(`${k.replace(/([A-Z])/g, ' $1').trim()}: ${String(metrics[k])}`)
    if (lines.length >= 3) break
  }
  return lines
}
