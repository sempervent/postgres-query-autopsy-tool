import type { PlanWorkerStats } from '../api/types'

export function getWorkersFromPlanNode(node: unknown): PlanWorkerStats[] {
  if (!node || typeof node !== 'object') return []
  const raw = (node as Record<string, unknown>).workers
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.filter((x) => x && typeof x === 'object') as PlanWorkerStats[]
}

function nums(ws: PlanWorkerStats[], pick: (w: PlanWorkerStats) => number | null | undefined): number[] {
  return ws.map(pick).filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
}

function fmt(n: number): string {
  if (Math.abs(n) >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** Compact one-line cue for node header (evidence-based, conservative). */
export function workerSummaryCue(workers: PlanWorkerStats[]): string | null {
  if (!workers.length) return null
  const n = workers.length
  const parts: string[] = [`Workers: ${n}`]

  const reads = nums(workers, (w) => w.sharedReadBlocks ?? null)
  if (reads.length >= 2) {
    const mn = Math.min(...reads)
    const mx = Math.max(...reads)
    if (mx !== mn) parts.push(`reads ${fmt(mn)}–${fmt(mx)}`)
  }

  const times = nums(workers, (w) => w.actualTotalTimeMs ?? null)
  if (times.length >= 2) {
    const mn = Math.min(...times)
    const mx = Math.max(...times)
    if (mx > mn * 1.2) parts.push(`total time spans ${fmt(mn)}–${fmt(mx)}ms`)
  }

  const anyTemp = workers.some(
    (w) =>
      (w.tempReadBlocks != null && w.tempReadBlocks !== 0) ||
      (w.tempWrittenBlocks != null && w.tempWrittenBlocks !== 0),
  )
  if (anyTemp) parts.push('temp I/O on workers')

  return parts.join(' · ')
}

export type WorkerTableRow = {
  workerNumber: string
  totalTime: string
  rows: string
  sharedHit: string
  sharedRead: string
  temp: string
}

export function workerTableRows(workers: PlanWorkerStats[]): WorkerTableRow[] {
  return workers.map((w) => {
    const tr = w.tempReadBlocks != null || w.tempWrittenBlocks != null
      ? `${w.tempReadBlocks ?? '—'} / ${w.tempWrittenBlocks ?? '—'}`
      : '—'
    return {
      workerNumber: w.workerNumber != null ? String(w.workerNumber) : '—',
      totalTime: w.actualTotalTimeMs != null ? `${fmt(w.actualTotalTimeMs)}ms` : '—',
      rows: w.actualRows != null ? fmt(w.actualRows) : '—',
      sharedHit: w.sharedHitBlocks != null ? fmt(w.sharedHitBlocks) : '—',
      sharedRead: w.sharedReadBlocks != null ? fmt(w.sharedReadBlocks) : '—',
      temp: tr,
    }
  })
}
