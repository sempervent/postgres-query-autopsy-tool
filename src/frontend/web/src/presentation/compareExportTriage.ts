import type { NodePairDetail, PlanComparisonResult } from '../api/types'
import type { CompareLeadTakeaway } from './compareOutputGuidance'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Compact triage block for Compare downloads (Phase 113). */
export type CompareExportTriageSummary = {
  changeHeadline: string
  changeOverviewLine: string | null
  readingThreadLine: string | null
  primaryPairArtifactId: string | null
  comparisonId: string
}

export function buildCompareExportTriageSummary(
  comparison: PlanComparisonResult,
  selectedDetail: NodePairDetail | null,
  opts: {
    lead: CompareLeadTakeaway | null
    triageBridgeLine: string | null | undefined
    continuitySummaryCue: string | null | undefined
  },
): CompareExportTriageSummary | null {
  const id = comparison.comparisonId?.trim()
  if (!id) return null
  const lead = opts.lead
  const thread = opts.triageBridgeLine?.trim() || opts.continuitySummaryCue?.trim() || null
  return {
    changeHeadline: lead?.headline?.trim() || 'Change at a glance',
    changeOverviewLine: lead?.line?.trim() || null,
    readingThreadLine: thread,
    primaryPairArtifactId: selectedDetail?.pairArtifactId?.trim() || null,
    comparisonId: id,
  }
}

/**
 * Phase 115: Markdown exports include a server **Reading thread** block; the client only adds
 * UI-specific selection context (pair bridge, primary pair id) when present — avoids duplicating the guided lead.
 */
export function markdownCompareExportSupplement(summary: CompareExportTriageSummary | null | undefined): string {
  const s = summary
  if (!s) return ''
  const bridge = s.readingThreadLine?.trim()
  const pair = s.primaryPairArtifactId?.trim()
  if (!bridge && !pair) return ''
  const lines: string[] = ['### Selection context', '']
  if (bridge) lines.push(`*${bridge}*`, '')
  if (pair) lines.push(`Primary pair for this export: \`${pair}\``, '')
  return `${lines.join('\n')}---\n\n`
}

/** @deprecated Prefer {@link markdownCompareExportSupplement}; full preamble duplicated server content (Phase 115). */
export function markdownCompareTriagePreamble(summary: CompareExportTriageSummary | null | undefined): string {
  return markdownCompareExportSupplement(summary)
}

/** Injects optional selection-context aside after `<body>` when bridge or pair id exists. */
export function injectCompareExportSupplementIntoHtml(html: string, summary: CompareExportTriageSummary | null | undefined): string {
  const s = summary
  if (!s) return html
  const bridge = s.readingThreadLine?.trim()
  const pair = s.primaryPairArtifactId?.trim()
  if (!bridge && !pair) return html
  const parts: string[] = ['<p style="margin:0;font-size:0.95rem"><b>Selection context</b></p>']
  if (bridge) {
    parts.push(`<p style="margin:8px 0 0;font-style:italic">${escapeHtml(bridge)}</p>`)
  }
  if (pair) {
    parts.push(`<p style="margin:8px 0 0;font-family:monospace;font-size:0.9rem">${escapeHtml(pair)}</p>`)
  }
  const block = `<aside class="pqat-exportTriage pqat-exportTriage--compareSupplement" style="margin:0 0 1.25rem;padding:12px 14px;border:1px solid #d4d0dc;border-radius:10px;background:#faf9fc">${parts.join('\n')}</aside>`
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}\n${block}\n`)
  }
  return `${block}\n${html}`
}

export function injectCompareTriageIntoHtml(html: string, summary: CompareExportTriageSummary | null | undefined): string {
  return injectCompareExportSupplementIntoHtml(html, summary)
}

export function jsonCompareExportWithTriageEnvelope(
  comparison: PlanComparisonResult,
  summary: CompareExportTriageSummary | null | undefined,
): Record<string, unknown> {
  const base = comparison as unknown as Record<string, unknown>
  const s = summary
  if (!s) return base
  return {
    pqatExportCompareTriage: {
      changeHeadline: s.changeHeadline,
      changeOverviewLine: s.changeOverviewLine,
      readingThreadLine: s.readingThreadLine,
      primaryPairArtifactId: s.primaryPairArtifactId,
      comparisonId: s.comparisonId,
    },
    ...base,
  }
}
