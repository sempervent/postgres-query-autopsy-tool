import type { ComparisonStory, PlanStory } from '../api/types'

/** Short label for summary deck / guide (Phase 60). */
export function planStoryDeckTitle(): string {
  return 'Plan story'
}

export function planStoryHasContent(s: PlanStory | null | undefined): boolean {
  return Boolean(s?.planOverview?.trim())
}

export function comparisonStoryHasContent(s: ComparisonStory | null | undefined): boolean {
  return Boolean(s?.overview?.trim())
}
