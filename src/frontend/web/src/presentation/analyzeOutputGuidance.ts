import type { OptimizationSuggestion, PlanAnalysisResult } from '../api/types'
import type { SuggestionListVirtualRow } from './optimizationSuggestionsPresentation'
import { planInspectFirstSteps } from './storyPresentation'

export type AnalyzeTakeaway = {
  headline: string
  supportingLine: string
  focusNodeId?: string
  /** Top ranked finding id when the takeaway is finding-driven (for findings-panel cascade). */
  primaryFindingId?: string
}

export type AnalyzeScanSignal = {
  label: string
  findingId: string
  focusNodeId?: string
}

function clipOneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function sortFindingsForDisplay(analysis: PlanAnalysisResult) {
  return [...analysis.findings].sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity
    return (b.rankScore ?? 0) - (a.rankScore ?? 0)
  })
}

/**
 * Single above-the-fold triage line: top finding, else first inspect step, else plan overview lead.
 */
export function analyzeTakeawayFromResult(analysis: PlanAnalysisResult): AnalyzeTakeaway | null {
  const top = sortFindingsForDisplay(analysis)[0]
  if (top) {
    return {
      headline: top.title,
      supportingLine: clipOneLine(top.summary || top.explanation || top.suggestion, 220),
      focusNodeId: top.nodeIds?.[0]?.trim() || undefined,
      primaryFindingId: top.findingId,
    }
  }

  const steps = planInspectFirstSteps(analysis.planStory)
  const st = steps[0]
  if (st) {
    return {
      headline: st.title,
      supportingLine: clipOneLine(st.body, 220),
      focusNodeId: st.focusNodeId?.trim() || undefined,
    }
  }

  const overview = analysis.planStory?.planOverview?.trim()
  if (overview) {
    return {
      headline: 'Plan overview',
      supportingLine: clipOneLine(overview, 240),
    }
  }

  return null
}

/** Single memoized bundle for summary + findings + rail (avoid recomputing takeaway twice). */
export type AnalyzeTriageBundle = {
  takeaway: AnalyzeTakeaway | null
  scanSignals: AnalyzeScanSignal[]
}

export function buildAnalyzeTriageBundle(analysis: PlanAnalysisResult): AnalyzeTriageBundle {
  const takeaway = analyzeTakeawayFromResult(analysis)
  return {
    takeaway,
    scanSignals: analyzeFollowUpScanSignals(analysis, takeaway?.primaryFindingId, 2),
  }
}

const normLabel = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Phase 116: drop “Also scan” chips that repeat the Start here headline — the summary already shows it.
 */
export function filterTriageEchoScanLabels(scanLabels: string[], takeaway: AnalyzeTakeaway | null): string[] {
  const h = takeaway?.headline ? normLabel(takeaway.headline) : ''
  if (!h) return scanLabels
  return scanLabels.filter((l) => {
    const nl = normLabel(l)
    if (nl === h) return false
    // Phase 120: drop chips that start the same way as the headline (near-duplicate echo).
    if (h.length >= 16 && nl.length >= 16 && h.slice(0, 22) === nl.slice(0, 22)) return false
    return true
  })
}

/** Next ranked findings after the primary (compact “also scan” strip). */
export function analyzeFollowUpScanSignals(
  analysis: PlanAnalysisResult,
  primaryFindingId: string | undefined,
  limit = 2,
): AnalyzeScanSignal[] {
  const sorted = sortFindingsForDisplay(analysis)
  const rest = primaryFindingId ? sorted.filter((f) => f.findingId !== primaryFindingId) : sorted.slice(1)
  return rest.slice(0, limit).map((f) => ({
    label: clipOneLine(f.title, 100),
    findingId: f.findingId,
    focusNodeId: f.nodeIds?.[0]?.trim() || undefined,
  }))
}

export type AnalyzeTriageSuggestionContext = {
  primaryFindingId?: string | null
  triageFocusNodeId?: string | null
  /** Node ids on the ranked primary finding (evidence overlap with suggestion targets). */
  primaryFindingNodeIds?: readonly string[] | null
}

/**
 * True when a suggestion is evidence-aligned with summary “Start here” without requiring `relatedFindingIds`
 * (Phase 111). Conservative: explicit finding link, shared focus node, or target/finding node overlap.
 */
export function suggestionAlignsWithAnalyzeTriage(
  s: OptimizationSuggestion,
  ctx: AnalyzeTriageSuggestionContext,
): boolean {
  const pid = ctx.primaryFindingId?.trim()
  if (pid && (s.relatedFindingIds ?? []).some((x) => String(x).trim() === pid)) return true

  const focus = ctx.triageFocusNodeId?.trim()
  const targets = new Set((s.targetNodeIds ?? []).map((x) => String(x).trim()).filter(Boolean))
  if (focus && targets.has(focus)) return true

  const fn = (ctx.primaryFindingNodeIds ?? []).map((x) => String(x).trim()).filter(Boolean)
  if (fn.length && targets.size && fn.some((n) => targets.has(n))) return true

  return false
}

/** First virtual list index (header or card rows) whose card aligns with triage — for scroll-into-view (Phase 112). */
export function firstVirtualRowIndexAlignedWithAnalyzeTriage(
  rows: readonly SuggestionListVirtualRow[],
  ctx: AnalyzeTriageSuggestionContext,
): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (row.kind === 'card' && suggestionAlignsWithAnalyzeTriage(row.suggestion, ctx)) return i
  }
  return -1
}
