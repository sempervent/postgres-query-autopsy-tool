import type { PlanBottleneckInsight } from '../api/types'

/** Short UI label for bottleneck kind (backend snake-ish kinds). */
export function bottleneckKindShortLabel(kind: string): string {
  switch (kind) {
    case 'time_exclusive':
      return 'Exclusive time'
    case 'time_subtree':
      return 'Subtree time'
    case 'io_read':
      return 'Shared reads'
    case 'finding':
      return 'Finding'
    case 'query_shape':
      return 'Query shape'
    default:
      return kind.replace(/_/g, ' ')
  }
}

export function bottlenecksForSummary(bottlenecks: PlanBottleneckInsight[] | null | undefined): PlanBottleneckInsight[] {
  if (!bottlenecks?.length) return []
  return [...bottlenecks].sort((a, b) => a.rank - b.rank)
}

/** Human label for API `bottleneckClass` (camelCase enum string). */
export function bottleneckClassShortLabel(bottleneckClass: string | undefined | null): string {
  switch (bottleneckClass) {
    case 'cpuHotspot':
      return 'CPU / operator work'
    case 'ioHotspot':
      return 'Shared-read / I/O'
    case 'sortOrSpillPressure':
      return 'Sort / spill pressure'
    case 'joinAmplification':
      return 'Join / repeated inner work'
    case 'scanFanout':
      return 'Scan fan-out'
    case 'aggregationPressure':
      return 'Aggregation'
    case 'queryShapeBoundary':
      return 'CTE / subquery boundary'
    case 'plannerMisestimation':
      return 'Planner mis-estimation'
    case 'accessPathMismatch':
      return 'Index path still heavy'
    case 'generalTime':
      return 'General timing'
    default:
      return bottleneckClass?.replace(/([A-Z])/g, ' $1').trim() || 'Bottleneck'
  }
}

/** Short UI line for `causeHint` (primary vs symptom framing). */
export function bottleneckCauseHintLine(causeHint: string | undefined | null): string | null {
  switch (causeHint) {
    case 'primaryFocus':
      return 'Primary focus — inspect here first'
    case 'downstreamSymptom':
      return 'Likely downstream — check upstream row volume / join shape too'
    case 'ambiguous':
      return 'Framing ambiguous — use card detail and parents'
    default:
      return null
  }
}
