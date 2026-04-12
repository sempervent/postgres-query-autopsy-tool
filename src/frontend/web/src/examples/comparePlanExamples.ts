/**
 * Curated Compare examples. JSON copied from `e2e/fixtures/` — keep in sync (`src/examples/README.md`).
 */
import planAfterRaw from './plans/compare-after-index-scan.json?raw'
import planBeforeRaw from './plans/compare-before-seq-scan.json?raw'
import bitmapPlanARaw from './plans/compare-bitmap-access-plan-a.json?raw'
import indexPlanBRaw from './plans/compare-index-scan-plan-b.json?raw'

export type ComparePlanExampleId = 'seq-scan-to-index' | 'bitmap-to-index-rows'

export type ComparePlanExample = {
  id: ComparePlanExampleId
  label: string
  blurb: string
  planAText: string
  planBText: string
}

export const COMPARE_PLAN_EXAMPLES: readonly ComparePlanExample[] = [
  {
    id: 'seq-scan-to-index',
    label: 'Seq scan → index scan',
    blurb: 'Same-shaped query: baseline is a sequential scan; revised plan uses an index—mapping and deltas read cleanly.',
    planAText: (planBeforeRaw as string).trim(),
    planBText: (planAfterRaw as string).trim(),
  },
  {
    id: 'bitmap-to-index-rows',
    label: 'Bitmap heap → index scan',
    blurb: 'Same filter, different access path: bitmap heap + index vs a direct index scan—useful for heap fetch and I/O contrasts.',
    planAText: (bitmapPlanARaw as string).trim(),
    planBText: (indexPlanBRaw as string).trim(),
  },
] as const

export function getComparePlanExample(id: ComparePlanExampleId): ComparePlanExample | undefined {
  return COMPARE_PLAN_EXAMPLES.find((e) => e.id === id)
}
