import type { AnalysisFinding } from '../api/types'

/** Highest severity among findings (for compact bridge summary). */
export function maxSeverityInFindings(findings: AnalysisFinding[]): number {
  if (!findings.length) return 0
  return findings.reduce((m, f) => Math.max(m, f.severity), 0)
}

export function severityLabel(sev: number): string {
  return ['Info', 'Low', 'Medium', 'High', 'Critical'][sev] ?? String(sev)
}

export function severityChipClass(sev: number): string {
  const n = Math.min(4, Math.max(0, sev))
  return `pqat-chip pqat-chip--sev${n}`
}

export function severityWord(sev: number): string {
  return severityLabel(Math.min(4, Math.max(0, sev)))
}

/**
 * Visible CTA copy shared across local shelf + bridge so graph → evidence → Ranked reads as one path.
 */
export const evidenceNavCopy = {
  /** Primary graph-era CTA copy (Phase 137): reads as optional depth, not the only way to understand the issue. */
  openInRankedList: 'Open in ranked list',
  openStrongestInRankedList: 'Open strongest in ranked list',
  fullWriteUpInRanked: 'Full write-up in Ranked',
  openStrongestWriteUpInRanked: 'Open strongest write-up in Ranked',
} as const

export function ariaLabelFullWriteUpInRankedList(findingTitle: string): string {
  return `Full write-up in ranked list: ${findingTitle}`
}

export function ariaLabelOpenStrongestInRankedList(findingTitle: string): string {
  return `Open strongest finding in ranked list: ${findingTitle}`
}

/** Model confidence (0–2) — aligned with findings list chips (Phase 127). */
export function findingConfidenceLabel(conf: number): string {
  return ['Low', 'Medium', 'High'][conf] ?? String(conf)
}
