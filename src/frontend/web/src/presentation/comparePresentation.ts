import type { PlanComparisonResult } from '../api/types'

export type CompareIntroCopy = {
  title: string
  subtitle: string
  bullets: string[]
  inputHints: string[]
}

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

export function compareIntroCopy(): CompareIntroCopy {
  return {
    title: 'Compare plans',
    subtitle:
      'Paste two PostgreSQL JSON plans. The tool maps nodes heuristically and highlights what changed (runtime, reads, and findings), with confidence surfaced where matches are uncertain.',
    bullets: [
      'Heuristic node mapping (not magical certainty)',
      'Top improved/worsened branches',
      'Twin branch context (path + children) for the selected pair',
      'Findings changes + context diffs',
      'Inspectable pair details + confidence',
    ],
    inputHints: ['Best input: `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)`', '`ANALYZE` improves runtime deltas; `BUFFERS` improves read deltas', 'If evidence is missing, sections will degrade gracefully'],
  }
}

export function compareEmptyStateCopy() {
  return {
    title: 'Paste two plans to compare',
    body: 'Provide Plan A and Plan B JSON, then click Compare. After it runs, start with “What changed most”, use the navigator lists, and read the branch context strip next to pair details to see where the selection sits in each plan.',
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

