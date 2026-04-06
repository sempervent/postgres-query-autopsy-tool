import type { ComparisonStory, PlanStory } from '../api/types'

/** Primary deck title — narrative-first analyze surface (Phase 62). */
export function planStoryDeckTitle(): string {
  return 'Plan briefing'
}

export function planStorySectionLabels() {
  return {
    orientation: 'Orientation',
    work: 'Work concentration',
    drivers: 'Pressure & cost drivers',
    startHere: 'Inspect first',
    flow: 'Propagation & flow',
    indexShape: 'Index / shape angle',
  } as const
}

export function comparisonStorySectionLabels() {
  return {
    deck: 'Change briefing',
    runtime: 'Runtime & I/O posture',
    structure: 'Structural deltas',
    walkthrough: 'Walk the diff',
    readout: 'Planner read',
  } as const
}

export function planStoryHasContent(s: PlanStory | null | undefined): boolean {
  return Boolean(s?.planOverview?.trim())
}

export function comparisonStoryHasContent(s: ComparisonStory | null | undefined): boolean {
  return Boolean(s?.overview?.trim())
}
