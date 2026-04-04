import { jsonGetHeaders, jsonPostHeaders } from './authHeaders'
import type {
  AppConfig,
  ExplainCaptureMetadata,
  PlanAnalysisResult,
  PlanComparisonResult,
} from './types'

export type UpdateArtifactSharingPayload = {
  accessScope: string
  sharedGroupIds?: string[]
  allowLinkAccess: boolean
}

export class ComparePlanParseError extends Error {
  side: string
  hint?: string

  constructor(side: string, message: string, hint?: string) {
    super(message)
    this.name = 'ComparePlanParseError'
    this.side = side
    this.hint = hint
  }
}

export class ComparisonNotFoundError extends Error {
  readonly comparisonId: string

  constructor(comparisonId: string) {
    super(
      `No stored comparison for id "${comparisonId}". It may be invalid, expired, or the database was reset.`,
    )
    this.name = 'ComparisonNotFoundError'
    this.comparisonId = comparisonId
  }
}

export class PlanParseError extends Error {
  readonly code: 'plan_parse_failed' = 'plan_parse_failed'
  hint?: string

  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'PlanParseError'
    this.hint = hint
  }
}

export class AccessDeniedError extends Error {
  readonly code = 'access_denied' as const
  readonly artifactId: string

  constructor(kind: 'analysis' | 'comparison', id: string) {
    super(
      kind === 'analysis'
        ? `Access denied for analysis "${id}". Sign in (or use a link-scoped artifact) per server policy.`
        : `Access denied for comparison "${id}".`,
    )
    this.name = 'AccessDeniedError'
    this.artifactId = id
  }
}

export class AnalysisNotFoundError extends Error {
  readonly code: 'analysis_not_found' = 'analysis_not_found'
  readonly analysisId: string

  constructor(analysisId: string) {
    super(
      `No stored analysis for id "${analysisId}". It may be invalid, expired, or the SQLite database file was removed or reset.`,
    )
    this.name = 'AnalysisNotFoundError'
    this.analysisId = analysisId
  }
}

/** Phase 40: server-stored JSON preference per authenticated user (`/api/me/preferences/{key}`). */
export const ANALYZE_WORKSPACE_PREFERENCE_KEY = 'analyze_workspace_v1'

export async function fetchUserPreference(key: string): Promise<unknown | null> {
  const res = await fetch(`/api/me/preferences/${encodeURIComponent(key)}`, { headers: jsonGetHeaders() })
  if (res.status === 401 || res.status === 404) return null
  if (!res.ok) return null
  try {
    const j = (await res.json()) as { value?: unknown }
    return j.value ?? null
  } catch {
    return null
  }
}

export async function saveUserPreference(key: string, value: unknown): Promise<boolean> {
  const res = await fetch(`/api/me/preferences/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: jsonPostHeaders(),
    body: JSON.stringify({ value }),
  })
  return res.ok
}

export async function fetchAppConfig(): Promise<AppConfig> {
  const res = await fetch('/api/config', { headers: jsonGetHeaders() })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Config request failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<AppConfig>
}

async function putSharing(
  url: string,
  payload: unknown,
  kind: 'analysis' | 'comparison',
  artifactId: string,
): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: jsonPostHeaders(),
    body: JSON.stringify(payload),
  })
  const text = await res.text().catch(() => '')
  if (res.status === 401) {
    throw new Error(
      'Authentication required: set VITE_AUTH_BEARER_TOKEN (or use non-auth deployment) — see docs.',
    )
  }
  if (res.status === 403) {
    throw new AccessDeniedError(kind, artifactId)
  }
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }
}

/** Update sharing for a persisted analysis (auth mode only; server returns `{ ok: true }`). */
export async function updateAnalysisSharing(
  analysisId: string,
  body: UpdateArtifactSharingPayload,
): Promise<void> {
  await putSharing(
    `/api/analyses/${encodeURIComponent(analysisId)}/sharing`,
    {
      accessScope: body.accessScope,
      sharedGroupIds: body.sharedGroupIds ?? [],
      allowLinkAccess: body.allowLinkAccess,
    },
    'analysis',
    analysisId,
  )
}

export async function updateComparisonSharing(
  comparisonId: string,
  body: UpdateArtifactSharingPayload,
): Promise<void> {
  await putSharing(
    `/api/comparisons/${encodeURIComponent(comparisonId)}/sharing`,
    {
      accessScope: body.accessScope,
      sharedGroupIds: body.sharedGroupIds ?? [],
      allowLinkAccess: body.allowLinkAccess,
    },
    'comparison',
    comparisonId,
  )
}

async function postJson<TResponse>(url: string, payload: unknown): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: jsonPostHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 401) {
      throw new Error(
        'Authentication required: set VITE_AUTH_BEARER_TOKEN (or use non-auth deployment) — see docs.',
      )
    }
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }

  return res.json() as Promise<TResponse>
}

export async function analyzePlan(plan: unknown): Promise<PlanAnalysisResult> {
  return postJson<PlanAnalysisResult>('/api/analyze', { plan })
}

/** Load a persisted analysis snapshot (opaque id from a prior analyze or share link). */
export async function getAnalysis(analysisId: string): Promise<PlanAnalysisResult> {
  const res = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}`, { headers: jsonGetHeaders() })
  if (res.status === 403) {
    throw new AccessDeniedError('analysis', analysisId)
  }
  if (res.status === 404) {
    let body: { analysisId?: string } = {}
    try {
      body = (await res.json()) as { analysisId?: string }
    } catch {
      /* ignore */
    }
    throw new AnalysisNotFoundError(body.analysisId ?? analysisId)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }
  return res.json() as Promise<PlanAnalysisResult>
}

export async function analyzePlanWithQuery(
  planText: string,
  queryText: string | null | undefined,
  explainMetadata?: ExplainCaptureMetadata | null,
): Promise<PlanAnalysisResult> {
  const body: Record<string, unknown> = {
    planText,
    queryText: queryText && queryText.trim().length ? queryText : null,
  }
  if (explainMetadata && (explainMetadata.options || explainMetadata.sourceExplainCommand?.trim())) {
    body.explainMetadata = {
      options: explainMetadata.options ?? null,
      sourceExplainCommand: explainMetadata.sourceExplainCommand?.trim() || null,
    }
  }
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: jsonPostHeaders(),
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    if (res.status === 400) {
      try {
        const j = JSON.parse(text) as { error?: string; message?: string; hint?: string }
        if (j.error === 'plan_parse_failed') {
          throw new PlanParseError(
            j.message?.trim() ||
              'The pasted text could not be turned into valid EXPLAIN JSON.',
            j.hint?.trim(),
          )
        }
      } catch (e) {
        if (e instanceof PlanParseError) throw e
      }
    }
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }
  return JSON.parse(text) as PlanAnalysisResult
}

export async function comparePlans(planA: unknown, planB: unknown): Promise<PlanComparisonResult> {
  return postJson<PlanComparisonResult>('/api/compare', { planA, planB })
}

export async function comparePlansWithDiagnostics(planA: unknown, planB: unknown, diagnostics: boolean): Promise<PlanComparisonResult> {
  const url = diagnostics ? '/api/compare?diagnostics=1' : '/api/compare'
  return postJson<PlanComparisonResult>(url, { planA, planB })
}

export async function getComparison(comparisonId: string): Promise<PlanComparisonResult> {
  const res = await fetch(`/api/comparisons/${encodeURIComponent(comparisonId)}`, { headers: jsonGetHeaders() })
  if (res.status === 403) {
    throw new AccessDeniedError('comparison', comparisonId)
  }
  if (res.status === 404) {
    let body: { comparisonId?: string } = {}
    try {
      body = (await res.json()) as { comparisonId?: string }
    } catch {
      /* ignore */
    }
    throw new ComparisonNotFoundError(body.comparisonId ?? comparisonId)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }
  return res.json() as Promise<PlanComparisonResult>
}

export async function compareWithPlanTexts(args: {
  planAText: string
  planBText: string
  queryTextA?: string | null
  queryTextB?: string | null
  explainMetadataA?: ExplainCaptureMetadata | null
  explainMetadataB?: ExplainCaptureMetadata | null
  diagnostics?: boolean
}): Promise<PlanComparisonResult> {
  const url = args.diagnostics ? '/api/compare?diagnostics=1' : '/api/compare'
  const body: Record<string, unknown> = {
    planAText: args.planAText,
    planBText: args.planBText,
    queryTextA: args.queryTextA?.trim() ? args.queryTextA : null,
    queryTextB: args.queryTextB?.trim() ? args.queryTextB : null,
  }
  const attach = (key: 'explainMetadataA' | 'explainMetadataB', m: ExplainCaptureMetadata | null | undefined) => {
    if (m && (m.options || m.sourceExplainCommand?.trim())) {
      body[key] = {
        options: m.options ?? null,
        sourceExplainCommand: m.sourceExplainCommand?.trim() || null,
      }
    }
  }
  attach('explainMetadataA', args.explainMetadataA)
  attach('explainMetadataB', args.explainMetadataB)

  const res = await fetch(url, {
    method: 'POST',
    headers: jsonPostHeaders(),
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        'Authentication required: set VITE_AUTH_BEARER_TOKEN (or use non-auth deployment) — see docs.',
      )
    }
    if (res.status === 400) {
      try {
        const j = JSON.parse(text) as {
          error?: string
          side?: string
          message?: string
          hint?: string
        }
        if (j.error === 'plan_parse_failed' && j.side) {
          throw new ComparePlanParseError(
            j.side,
            j.message?.trim() || 'Plan text could not be normalized.',
            j.hint?.trim(),
          )
        }
      } catch (e) {
        if (e instanceof ComparePlanParseError) throw e
      }
    }
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }
  return JSON.parse(text) as PlanComparisonResult
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

