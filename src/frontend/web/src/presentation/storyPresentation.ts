import type { ComparisonStory, InspectFirstStep, PlanStory } from '../api/types'

/** Primary deck title — narrative-first analyze surface (Phase 62). */
export function planStoryDeckTitle(): string {
  return 'Plan briefing'
}

export function planStorySectionLabels() {
  return {
    orientation: 'What this plan is doing',
    work: 'Where work piles up',
    drivers: 'What is driving cost',
    startHere: 'Start here',
    flow: 'Propagation & flow',
    indexShape: 'Index / shape angle',
  } as const
}

export function comparisonStorySectionLabels() {
  return {
    deck: 'Change briefing',
    runtime: 'Wall-clock & rewrite result',
    structure: 'What moved in the plan',
    walkthrough: 'How to read this comparison',
    readout: 'Planner-shaped read',
  } as const
}

export function planStoryHasContent(s: PlanStory | null | undefined): boolean {
  return Boolean(s?.planOverview?.trim())
}

/** Phase 83: prefer structured inspect steps when the API provides them. */
export function planInspectFirstSteps(story: PlanStory | null | undefined): InspectFirstStep[] {
  const steps = story?.inspectFirstSteps
  return steps?.length ? steps : []
}

export function comparisonStoryHasContent(s: ComparisonStory | null | undefined): boolean {
  return Boolean(s?.overview?.trim())
}
