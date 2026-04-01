/** API `node` payload uses camelCase buffer fields matching the backend normalized model. */

const entries: { apiKey: string; label: string }[] = [
  { apiKey: 'sharedHitBlocks', label: 'Shared hit blocks' },
  { apiKey: 'sharedReadBlocks', label: 'Shared read blocks' },
  { apiKey: 'sharedDirtiedBlocks', label: 'Shared dirtied blocks' },
  { apiKey: 'sharedWrittenBlocks', label: 'Shared written blocks' },
  { apiKey: 'localHitBlocks', label: 'Local hit blocks' },
  { apiKey: 'localReadBlocks', label: 'Local read blocks' },
  { apiKey: 'localDirtiedBlocks', label: 'Local dirtied blocks' },
  { apiKey: 'localWrittenBlocks', label: 'Local written blocks' },
  { apiKey: 'tempReadBlocks', label: 'Temp read blocks' },
  { apiKey: 'tempWrittenBlocks', label: 'Temp written blocks' },
]

export function planNodeApiHasAnyBufferCounter(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const o = node as Record<string, unknown>
  return entries.some(({ apiKey }) => o[apiKey] != null)
}

export type BufferCounterRow = { label: string; value: string }

/** Renders only keys that are present (including explicit zero). */
export function bufferCounterRowsForApiNode(node: unknown): BufferCounterRow[] {
  if (!node || typeof node !== 'object') return []
  const o = node as Record<string, unknown>
  const out: BufferCounterRow[] = []
  for (const { apiKey, label } of entries) {
    const v = o[apiKey]
    if (v == null) continue
    out.push({ label, value: typeof v === 'number' ? String(v) : String(v) })
  }
  return out
}
