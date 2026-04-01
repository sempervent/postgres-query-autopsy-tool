import { describe, expect, it } from 'vitest'
import type { PlanWorkerStats } from '../api/types'
import { getWorkersFromPlanNode, workerSummaryCue, workerTableRows } from './workerPresentation'

describe('getWorkersFromPlanNode', () => {
  it('returns empty for missing or invalid workers', () => {
    expect(getWorkersFromPlanNode(null)).toEqual([])
    expect(getWorkersFromPlanNode({})).toEqual([])
    expect(getWorkersFromPlanNode({ workers: null })).toEqual([])
    expect(getWorkersFromPlanNode({ workers: [] })).toEqual([])
    expect(getWorkersFromPlanNode({ workers: 'x' })).toEqual([])
  })

  it('returns typed worker objects from node.workers', () => {
    const w: PlanWorkerStats[] = [{ workerNumber: 0, sharedReadBlocks: 10 }]
    expect(getWorkersFromPlanNode({ workers: w })).toEqual(w)
  })
})

describe('workerSummaryCue', () => {
  it('returns null when no workers', () => {
    expect(workerSummaryCue([])).toBeNull()
  })

  it('includes count and read span when reads differ', () => {
    const cue = workerSummaryCue([
      { workerNumber: 0, sharedReadBlocks: 39860 },
      { workerNumber: 1, sharedReadBlocks: 40225 },
    ])
    expect(cue).toContain('Workers: 2')
    expect(cue).toMatch(/reads/)
    expect(cue).toMatch(/39,?860/)
    expect(cue).toMatch(/40,?225/)
  })

  it('matches complex_timescaledb_query worker shared-read span in summary cue (regression)', () => {
    // Same representative per-worker shared reads as partial aggregate workers in that fixture.
    const cue = workerSummaryCue([
      { workerNumber: 0, sharedReadBlocks: 39860, actualTotalTimeMs: 2773.505 },
      { workerNumber: 1, sharedReadBlocks: 40225, actualTotalTimeMs: 2813.364 },
    ])
    expect(cue).toContain('Workers: 2')
    expect(cue).toMatch(/reads/)
  })

  it('mentions temp I/O when any worker has temp counters', () => {
    const cue = workerSummaryCue([
      { workerNumber: 0, tempReadBlocks: 1 },
      { workerNumber: 1 },
    ])
    expect(cue).toContain('temp I/O on workers')
  })
})

describe('workerTableRows', () => {
  it('formats columns for display', () => {
    const rows = workerTableRows([
      {
        workerNumber: 0,
        actualTotalTimeMs: 12.5,
        actualRows: 1000,
        sharedHitBlocks: 500,
        sharedReadBlocks: 200,
        tempReadBlocks: 0,
        tempWrittenBlocks: 3,
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      workerNumber: '0',
      totalTime: '12.50ms',
      rows: '1000',
      sharedHit: '500',
      sharedRead: '200',
      temp: '0 / 3',
    })
  })
})
