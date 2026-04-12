/**
 * Curated in-app examples. Source JSON is copied from `e2e/fixtures/` for stable E2E parity;
 * keep copies in sync when fixture semantics change (`src/examples/README.md`).
 */
import indexOrderedRaw from './plans/index-ordered-shipments.json?raw'
import nlJoinInnerHeavyRaw from './plans/nl-join-inner-heavy.json?raw'
import simpleSeqScanRaw from './plans/simple-seq-scan.json?raw'
import sortPressureRaw from './plans/sort-pressure-shipments.json?raw'

export type AnalyzePlanExampleId =
  | 'simple-seq-scan'
  | 'sort-pressure-shipments'
  | 'index-ordered-shipments'
  | 'nl-join-inner-heavy'

export type AnalyzePlanExample = {
  id: AnalyzePlanExampleId
  /** Short button / menu label */
  label: string
  /** One line: what the user will see */
  blurb: string
  jsonText: string
}

const simpleSeqScanJson = simpleSeqScanRaw as string
const sortPressureJson = sortPressureRaw as string
const indexOrderedJson = indexOrderedRaw as string
const nlJoinInnerHeavyJson = nlJoinInnerHeavyRaw as string

export const ANALYZE_PLAN_EXAMPLES: readonly AnalyzePlanExample[] = [
  {
    id: 'simple-seq-scan',
    label: 'Simple filter + seq scan',
    blurb: 'Small plan with a sequential scan—fastest way to see findings, graph, and triage.',
    jsonText: simpleSeqScanJson.trim(),
  },
  {
    id: 'sort-pressure-shipments',
    label: 'Sort on top of a scan',
    blurb: 'Ordering work above a filtered scan—sort / IO pressure.',
    jsonText: sortPressureJson.trim(),
  },
  {
    id: 'index-ordered-shipments',
    label: 'Index scan + ordering',
    blurb: 'Index access with sort still present—contrasts with plain seq+sort.',
    jsonText: indexOrderedJson.trim(),
  },
  {
    id: 'nl-join-inner-heavy',
    label: 'Nested loop · inner seq',
    blurb: 'Join with a hot inner sequential scan—nested-loop amplification story.',
    jsonText: nlJoinInnerHeavyJson.trim(),
  },
] as const

export function getAnalyzePlanExample(id: AnalyzePlanExampleId): AnalyzePlanExample | undefined {
  return ANALYZE_PLAN_EXAMPLES.find((e) => e.id === id)
}
