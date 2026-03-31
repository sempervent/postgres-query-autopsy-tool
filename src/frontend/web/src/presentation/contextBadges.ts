import type { EvidenceChangeDirection, OperatorContextEvidenceDiff } from '../api/types'

export type Badge = { text: string; tone: 'good' | 'bad' | 'neutral' | 'mixed' }

function tone(dir: EvidenceChangeDirection): Badge['tone'] {
  if (dir === 'Improved') return 'good'
  if (dir === 'Worsened') return 'bad'
  if (dir === 'Mixed') return 'mixed'
  return 'neutral'
}

export function contextBadges(diff: OperatorContextEvidenceDiff | null | undefined, maxBadges = 3): Badge[] {
  if (!diff) return []
  const b: Badge[] = []

  if (diff.hashBuild?.pressureDirection && diff.hashBuild.pressureDirection !== 'NotApplicable') {
    b.push({ text: `hash pressure ${arrow(diff.hashBuild.pressureDirection)}`, tone: tone(diff.hashBuild.pressureDirection) })
  }
  if (diff.scanWaste?.wasteDirection && diff.scanWaste.wasteDirection !== 'NotApplicable') {
    b.push({ text: `scan waste ${arrow(diff.scanWaste.wasteDirection)}`, tone: tone(diff.scanWaste.wasteDirection) })
  }
  if (diff.sort?.sortSpillDirection && diff.sort.sortSpillDirection !== 'NotApplicable') {
    b.push({ text: `sort spill ${arrow(diff.sort.sortSpillDirection)}`, tone: tone(diff.sort.sortSpillDirection) })
  }
  if (diff.memoize?.effectivenessDirection && diff.memoize.effectivenessDirection !== 'NotApplicable') {
    b.push({ text: `memoize ${arrow(diff.memoize.effectivenessDirection)}`, tone: tone(diff.memoize.effectivenessDirection) })
  }
  if (diff.nestedLoop?.amplificationDirection && diff.nestedLoop.amplificationDirection !== 'NotApplicable') {
    b.push({ text: `nested loop ${arrow(diff.nestedLoop.amplificationDirection)}`, tone: tone(diff.nestedLoop.amplificationDirection) })
  }

  if (b.length === 0 && diff.overallDirection) {
    b.push({ text: `context ${diff.overallDirection.toLowerCase()}`, tone: tone(diff.overallDirection) })
  }

  return b.slice(0, maxBadges)
}

function arrow(dir: EvidenceChangeDirection): string {
  if (dir === 'Improved') return '↓'
  if (dir === 'Worsened') return '↑'
  if (dir === 'Mixed') return '±'
  if (dir === 'Neutral') return '•'
  return '?'
}

