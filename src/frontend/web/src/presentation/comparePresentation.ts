import type { PlanComparisonResult } from '../api/types'
import { relatedFindingRuleHints, relatedFindingRuleHintsByDiffIds } from './compareIndexLinks'
import { formatIndexInsightDiffKind } from './indexInsightPresentation'

export type CompareSummaryCard = {
  key: string
  label: string
  value: string
  deltaLabel?: string | null
  tone?: 'good' | 'bad' | 'neutral'
}

function n(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

function fmtMs(x: number | null | undefined): string {
  if (x == null) return '—'
  if (x >= 1000) return `${(x / 1000).toFixed(2)}s`
  return `${x.toFixed(0)}ms`
}

function fmtInt(x: number | null | undefined): string {
  if (x == null) return '—'
  return `${Math.round(x)}`
}

function deltaTone(delta: number | null | undefined, higherIsWorse: boolean): 'good' | 'bad' | 'neutral' {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return 'neutral'
  const worsened = higherIsWorse ? delta > 0 : delta < 0
  return worsened ? 'bad' : 'good'
}

function deltaArrow(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return '→'
  return delta > 0 ? '↑' : '↓'
}

export function compareEmptyStateCopy() {
  return {
    title: 'Compare two plans',
    body: 'Paste Plan A and B, or load a sample pair above, then run Compare. Press ? or open How to use Compare for a short tour.',
  }
}

export function compareCoverageLine(c: PlanComparisonResult | null): string | null {
  if (!c) return null
  const mapped = c.matches?.length ?? null
  const ua = c.unmatchedNodeIdsA?.length ?? null
  const ub = c.unmatchedNodeIdsB?.length ?? null
  const parts: string[] = []
  if (mapped != null) parts.push(`${mapped} mapped pair${mapped === 1 ? '' : 's'}`)
  if (ua != null) parts.push(`${ua} unmatched in A`)
  if (ub != null) parts.push(`${ub} unmatched in B`)
  return parts.length ? parts.join(' · ') : null
}

export function buildCompareSummaryCards(c: PlanComparisonResult | null): CompareSummaryCard[] {
  if (!c) return []
  const s = c.summary

  const runtimeDelta = n(s.runtimeDeltaMs)
  const readsDelta = n(s.sharedReadDeltaBlocks)
  const severeDelta = n(s.severeFindingsDelta)
  const nodeDelta = n(s.nodeCountDelta)
  const depthDelta = n(s.maxDepthDelta)

  return [
    {
      key: 'runtime',
      label: 'Total runtime',
      value: fmtMs(n(s.runtimeMsB)),
      deltaLabel: runtimeDelta != null ? `${deltaArrow(runtimeDelta)} ${fmtMs(Math.abs(runtimeDelta))}` : null,
      tone: deltaTone(runtimeDelta, true),
    },
    {
      key: 'reads',
      label: 'Shared reads',
      value: fmtInt(n(s.sharedReadBlocksB)),
      deltaLabel: readsDelta != null ? `${deltaArrow(readsDelta)} ${fmtInt(Math.abs(readsDelta))}` : null,
      tone: deltaTone(readsDelta, true),
    },
    {
      key: 'severe',
      label: 'Severe findings',
      value: fmtInt(n(s.severeFindingsCountB)),
      deltaLabel: severeDelta != null ? `${deltaArrow(severeDelta)} ${fmtInt(Math.abs(severeDelta))}` : null,
      tone: deltaTone(severeDelta, true),
    },
    {
      key: 'nodes',
      label: 'Nodes',
      value: fmtInt(n(s.nodeCountB)),
      deltaLabel: nodeDelta != null ? `${deltaArrow(nodeDelta)} ${fmtInt(Math.abs(nodeDelta))}` : null,
      tone: deltaTone(nodeDelta, false),
    },
    {
      key: 'depth',
      label: 'Max depth',
      value: fmtInt(n(s.maxDepthB)),
      deltaLabel: depthDelta != null ? `${deltaArrow(depthDelta)} ${fmtInt(Math.abs(depthDelta))}` : null,
      tone: deltaTone(depthDelta, false),
    },
  ]
}

export function compareWhatChangedMostCopy() {
  return {
    title: 'What changed most',
    subtitle: 'Start here. Pick one improved and one worsened area, then inspect the selected pair panel for context and confidence.',
  }
}

export type CompareIndexSectionRow = {
  diffIndex: number
  insightDiffId: string
  kindLabel: string
  summary: string
  relatedFindingIndexes: number[]
  relatedFindingDiffIds: string[]
  relatedFindingHints: string[]
}

export type CompareIndexSectionModel = {
  headlineNew: string | null
  headlineResolved: string | null
  overviewLines: string[]
  topInsightDiffs: CompareIndexSectionRow[]
  chunkedNuance: boolean
}

export function buildCompareIndexSectionModel(c: PlanComparisonResult | null): CompareIndexSectionModel | null {
  const idx = c?.indexComparison
  if (!idx) return null
  const diffs = idx.insightDiffs ?? []
  const interesting = diffs
    .map((d, diffIndex) => ({ d, diffIndex }))
    .filter(({ d }) => formatIndexInsightDiffKind(d.kind) !== 'Unchanged')
  const firstNew = interesting.find(({ d }) => formatIndexInsightDiffKind(d.kind) === 'New')
  const firstResolved = interesting.find(({ d }) => formatIndexInsightDiffKind(d.kind) === 'Resolved')
  return {
    headlineNew: firstNew?.d.summary ?? null,
    headlineResolved: firstResolved?.d.summary ?? null,
    overviewLines: idx.overviewLines ?? [],
    topInsightDiffs: interesting
      .slice(0, 6)
      .map(({ d, diffIndex }) => {
        const relatedFindingIndexes = (d.relatedFindingDiffIndexes ?? []).slice(0, 4)
        const relatedFindingDiffIds = (d.relatedFindingDiffIds ?? []).slice(0, 4)
        const relatedFindingHints =
          relatedFindingDiffIds.length > 0
            ? relatedFindingRuleHintsByDiffIds(c, relatedFindingDiffIds)
            : relatedFindingRuleHints(c, relatedFindingIndexes)
        return {
          diffIndex,
          insightDiffId: d.insightDiffId ?? '',
          kindLabel: formatIndexInsightDiffKind(d.kind),
          summary: d.summary,
          relatedFindingIndexes,
          relatedFindingDiffIds,
          relatedFindingHints,
        }
      }),
    chunkedNuance: Boolean(idx.eitherPlanSuggestsChunkedBitmapWorkload),
  }
}

