import type {
  PlanAnalysisResult,
  PlanComparisonResult,
} from './types'

async function postJson<TResponse>(url: string, payload: unknown): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }

  return res.json() as Promise<TResponse>
}

export async function analyzePlan(plan: unknown): Promise<PlanAnalysisResult> {
  return postJson<PlanAnalysisResult>('/api/analyze', { plan })
}

export async function comparePlans(planA: unknown, planB: unknown): Promise<PlanComparisonResult> {
  return postJson<PlanComparisonResult>('/api/compare', { planA, planB })
}

export async function comparePlansWithDiagnostics(planA: unknown, planB: unknown, diagnostics: boolean): Promise<PlanComparisonResult> {
  const url = diagnostics ? '/api/compare?diagnostics=1' : '/api/compare'
  return postJson<PlanComparisonResult>(url, { planA, planB })
}

export async function exportMarkdown(analysis: PlanAnalysisResult): Promise<{ analysisId: string; markdown: string }> {
  return postJson('/api/report/markdown', { analysis })
}

export async function exportHtml(analysis: PlanAnalysisResult): Promise<{ analysisId: string; html: string }> {
  return postJson('/api/report/html', { analysis })
}

export async function exportJson(analysis: PlanAnalysisResult): Promise<PlanAnalysisResult> {
  return postJson('/api/report/json', { analysis })
}

