import type { FindingDiffItem, PlanComparisonResult } from '../api/types'

/** Human-readable tail after first dot in rule id (e.g. `F.seq-scan-concern` → `seq-scan-concern`). */
export function findingRuleTail(ruleId: string): string {
  const i = ruleId.indexOf('.')
  return i >= 0 && i < ruleId.length - 1 ? ruleId.slice(i + 1) : ruleId
}

export function relatedIndexDeltaCue(count: number): string {
  return count === 1 ? '1 related index delta' : `${count} related index deltas`
}

export function relatedFindingChangesCue(count: number): string {
  return count === 1 ? 'Supported by 1 finding change' : `Supported by ${count} finding changes`
}

/** Rule tails for findings diff rows at the given indices (bounded). */
export function relatedFindingRuleHints(c: PlanComparisonResult | null, findingIndexes: number[] | undefined | null): string[] {
  const items = c?.findingsDiff?.items
  if (!items?.length || !findingIndexes?.length) return []
  const out: string[] = []
  for (const fi of findingIndexes) {
    if (fi < 0 || fi >= items.length) continue
    const f = items[fi] as FindingDiffItem
    if (!f?.ruleId) continue
    out.push(findingRuleTail(f.ruleId))
    if (out.length >= 3) break
  }
  return out
}

/** Rule tails from stable finding diff ids (`fd_*`). */
export function relatedFindingRuleHintsByDiffIds(
  c: PlanComparisonResult | null,
  diffIds: string[] | undefined | null,
): string[] {
  const items = c?.findingsDiff?.items
  if (!items?.length || !diffIds?.length) return []
  const out: string[] = []
  for (const id of diffIds) {
    const f = items.find((x) => x.diffId === id)
    if (!f?.ruleId) continue
    out.push(findingRuleTail(f.ruleId))
    if (out.length >= 3) break
  }
  return out
}
