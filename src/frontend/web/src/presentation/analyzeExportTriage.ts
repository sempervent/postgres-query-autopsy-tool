import type { AnalyzeTakeaway } from './analyzeOutputGuidance'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Compact Markdown preamble mirroring in-app Start here (Phase 112 export parity). */
export function markdownTriagePreamble(takeaway: AnalyzeTakeaway | null | undefined): string {
  const t = takeaway
  if (!t?.headline?.trim()) return ''
  const support = (t.supportingLine ?? '').trim()
  const lines = ['## Start here', '', `**${t.headline.trim()}**`, '']
  if (support) lines.push(support, '')
  lines.push('---', '', '')
  return lines.join('\n')
}

/** Inject a short Start here block after `<body>` when present (Phase 112). */
export function injectTriageIntoHtml(html: string, takeaway: AnalyzeTakeaway | null | undefined): string {
  const t = takeaway
  if (!t?.headline?.trim()) return html
  const support = (t.supportingLine ?? '').trim()
  const head = escapeHtml(t.headline.trim())
  const sup = support ? `<p style="margin:8px 0 0">${escapeHtml(support)}</p>` : ''
  const block = `<aside class="pqat-exportTriage" style="margin:0 0 1.25rem;padding:12px 14px;border:1px solid #d4d0dc;border-radius:10px;background:#faf9fc"><h2 style="margin:0;font-size:1.05rem">Start here</h2><p style="margin:6px 0 0;font-weight:600">${head}</p>${sup}</aside>`
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}\n${block}\n`)
  }
  return `${block}\n${html}`
}

/** Shallow merge for downloaded JSON — triage metadata first for human scanning (Phase 112). */
export function jsonExportWithTriageEnvelope(
  analysis: import('../api/types').PlanAnalysisResult,
  takeaway: AnalyzeTakeaway | null | undefined,
): Record<string, unknown> {
  const base = analysis as unknown as Record<string, unknown>
  const t = takeaway
  if (!t?.headline?.trim()) return base
  return {
    pqatExportTriage: {
      startHereHeadline: t.headline.trim(),
      startHereSummary: (t.supportingLine ?? '').trim() || null,
      primaryFindingId: t.primaryFindingId ?? null,
      focusNodeId: t.focusNodeId ?? null,
    },
    ...base,
  }
}
