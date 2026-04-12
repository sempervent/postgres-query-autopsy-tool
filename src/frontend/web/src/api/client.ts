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

/** Phase 49: **422** `artifact_corrupt` from persisted artifact GET. */
export class ArtifactCorruptError extends Error {
  readonly code = 'artifact_corrupt' as const
  readonly artifactKind: 'analysis' | 'comparison'
  readonly artifactId: string

  constructor(kind: 'analysis' | 'comparison', artifactId: string, message?: string | null) {
    const fallback =
      kind === 'analysis'
        ? 'This saved analysis could not be read. The stored snapshot may be corrupt or in an unreadable shape.'
        : 'This saved comparison could not be read. The stored snapshot may be corrupt or in an unreadable shape.'
    super((message && message.trim()) || fallback)
    this.name = 'ArtifactCorruptError'
    this.artifactKind = kind
    this.artifactId = artifactId
  }
}

/** Phase 49: **409** `artifact_version_unsupported` — payload schema newer than this server or explicitly rejected. */
export class ArtifactIncompatibleSchemaError extends Error {
  readonly code = 'artifact_version_unsupported' as const
  readonly artifactKind: 'analysis' | 'comparison'
  readonly artifactId: string
  readonly schemaVersion: number | null
  readonly maxSupported: number | null

  constructor(
    kind: 'analysis' | 'comparison',
    artifactId: string,
    message: string | null | undefined,
    schemaVersion: number | null,
    maxSupported: number | null,
  ) {
    const sv = schemaVersion != null ? String(schemaVersion) : 'unknown'
    const mx = maxSupported != null ? String(maxSupported) : 'unknown'
    const fallback =
      kind === 'analysis'
        ? `This saved analysis uses an unsupported artifact format (schema ${sv}; this server supports up to ${mx}). Update the server or open a freshly generated snapshot.`
        : `This saved comparison uses an unsupported artifact format (schema ${sv}; this server supports up to ${mx}). Update the server or open a freshly generated snapshot.`
    super((message && message.trim()) || fallback)
    this.name = 'ArtifactIncompatibleSchemaError'
    this.artifactKind = kind
    this.artifactId = artifactId
    this.schemaVersion = schemaVersion
    this.maxSupported = maxSupported
  }
}

type ArtifactGetErrorJson = {
  error?: string
  message?: string
  analysisId?: string
  comparisonId?: string
  schemaVersion?: number
  maxSupported?: number
}

function tryParseArtifactGetError(text: string): ArtifactGetErrorJson | null {
  try {
    return JSON.parse(text) as ArtifactGetErrorJson
  } catch {
    return null
  }
}

/** Phase 116: turn JSON / ProblemDetails-style bodies into a single user-facing line for exports and reports. */
export function formatApiErrorResponse(status: number, statusText: string, bodyText: string): string {
  const raw = bodyText.trim()
  if (!raw) {
    if (status === 400) {
      return 'This export did not reach the server intact. Reload and try again, or paste the plan text again before exporting.'
    }
    if (status === 401) {
      return 'Sign-in required for this action. Use the credentials your deployment expects (see docs), or a non-auth setup for local review.'
    }
    if (status === 413) {
      return 'This export is larger than the server accepts. Try a smaller plan or snapshot, or ask your administrator about request size limits.'
    }
    return `Request failed (${status} ${statusText}).`
  }
  try {
    const j = JSON.parse(raw) as {
      error?: string
      message?: string
      title?: string
      detail?: string
      side?: string
    }
    const title = j.title?.trim()
    const msg = j.message?.trim()
    const detail = j.detail?.trim()
    const errCode = j.error?.trim()
    // Phase 117: server export/report errors — show product message, not error codes.
    if (errCode === 'request_body_invalid' || errCode === 'export_request_incomplete') {
      if (msg) return msg
    }
    // Phase 118: size limits — prefer server message when JSON includes it (e.g. reverse-proxy payloads).
    if (status === 413 && (errCode === 'payload_too_large' || errCode === 'request_too_large') && msg) {
      return msg
    }
    // Phase 119: RFC 7807 ProblemDetails on 500 — calm line; skip stack-like detail.
    if (status >= 500 && title && !msg) {
      const looksLikeStack = detail && (detail.includes('   at ') || /\bat\s+[^\s()]+\(/i.test(detail))
      const safeDetail =
        detail && !looksLikeStack && detail.length <= 200 ? detail : null
      return safeDetail ? `${title} — ${safeDetail}` : `${title}. Try again in a moment.`
    }
    if (title && msg) return `${title} — ${msg}`
    if (title && detail) return `${title} — ${detail}`
    if (msg && j.error) return `${j.error}: ${msg}`
    if (msg) return msg
    if (detail) return detail
    if (j.error) return j.error
  } catch {
    /* fall through */
  }
  return `Request failed: ${status} ${statusText} — ${raw.length > 280 ? `${raw.slice(0, 280)}…` : raw}`
}

function throwFormattedHttpError(res: Response, text: string): never {
  throw new Error(formatApiErrorResponse(res.status, res.statusText, text))
}

/** Phase 40: server-stored JSON preference per authenticated user (`/api/me/preferences/{key}`). */
export const ANALYZE_WORKSPACE_PREFERENCE_KEY = 'analyze_workspace_v1'
export const COMPARE_WORKSPACE_PREFERENCE_KEY = 'compare_workspace_v1'
/** Phase 66: persisted appearance (`system` | `dark` | `light`) when auth + credentials. */
export const APPEARANCE_THEME_PREFERENCE_KEY = 'appearance_theme_v1'

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
    throw new Error(formatApiErrorResponse(401, res.statusText, text))
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
    throwFormattedHttpError(res, text)
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
  const textEarly = res.ok ? '' : await res.text().catch(() => '')
  if (res.status === 422) {
    const j = tryParseArtifactGetError(textEarly)
    if (j?.error === 'artifact_corrupt') {
      throw new ArtifactCorruptError('analysis', analysisId, j.message)
    }
  }
  if (res.status === 409) {
    const j = tryParseArtifactGetError(textEarly)
    if (j?.error === 'artifact_version_unsupported') {
      throw new ArtifactIncompatibleSchemaError(
        'analysis',
        analysisId,
        j.message,
        j.schemaVersion ?? null,
        j.maxSupported ?? null,
      )
    }
  }
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}${textEarly ? ` - ${textEarly}` : ''}`)
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
  const textEarly = res.ok ? '' : await res.text().catch(() => '')
  if (res.status === 422) {
    const j = tryParseArtifactGetError(textEarly)
    if (j?.error === 'artifact_corrupt') {
      throw new ArtifactCorruptError('comparison', comparisonId, j.message)
    }
  }
  if (res.status === 409) {
    const j = tryParseArtifactGetError(textEarly)
    if (j?.error === 'artifact_version_unsupported') {
      throw new ArtifactIncompatibleSchemaError(
        'comparison',
        comparisonId,
        j.message,
        j.schemaVersion ?? null,
        j.maxSupported ?? null,
      )
    }
  }
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}${textEarly ? ` - ${textEarly}` : ''}`)
  }
  return res.json() as Promise<PlanComparisonResult>
}

export type ComparePlanTextsPayload = {
  planAText: string
  planBText: string
  queryTextA?: string | null
  queryTextB?: string | null
  explainMetadataA?: ExplainCaptureMetadata | null
  explainMetadataB?: ExplainCaptureMetadata | null
}

/** Report/export: either plan text (rebuild) or full snapshot (reopened comparison). */
export type CompareExportReportPayload =
  | (ComparePlanTextsPayload & { comparison?: undefined; diagnostics?: boolean })
  | { comparison: PlanComparisonResult; diagnostics?: boolean }

export function buildCompareRequestPayload(args: ComparePlanTextsPayload): Record<string, unknown> {
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
  return body
}

export function buildCompareReportRequestBody(args: CompareExportReportPayload): Record<string, unknown> {
  if ('comparison' in args && args.comparison) {
    return { comparison: args.comparison }
  }
  return buildCompareRequestPayload(args as ComparePlanTextsPayload)
}

export async function compareWithPlanTexts(
  args: ComparePlanTextsPayload & { diagnostics?: boolean },
): Promise<PlanComparisonResult> {
  const url = args.diagnostics ? '/api/compare?diagnostics=1' : '/api/compare'
  const body = buildCompareRequestPayload(args)

  const res = await fetch(url, {
    method: 'POST',
    headers: jsonPostHeaders(),
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(formatApiErrorResponse(401, res.statusText, text))
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

async function postCompareReport<T>(
  path: '/api/compare/report/markdown' | '/api/compare/report/html' | '/api/compare/report/json',
  args: CompareExportReportPayload,
): Promise<T> {
  const diagnostics = 'comparison' in args && args.comparison ? args.diagnostics : (args as { diagnostics?: boolean }).diagnostics
  const q = diagnostics ? '?diagnostics=1' : ''
  const res = await fetch(`${path}${q}`, {
    method: 'POST',
    headers: jsonPostHeaders(),
    body: JSON.stringify(buildCompareReportRequestBody(args)),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    throwFormattedHttpError(res, text)
  }
  return JSON.parse(text) as T
}

export async function exportCompareMarkdown(
  args: CompareExportReportPayload,
): Promise<{ comparisonId: string; markdown: string }> {
  return postCompareReport('/api/compare/report/markdown', args)
}

export async function exportCompareHtml(
  args: CompareExportReportPayload,
): Promise<{ comparisonId: string; html: string }> {
  return postCompareReport('/api/compare/report/html', args)
}

export async function exportCompareJson(
  args: CompareExportReportPayload,
): Promise<PlanComparisonResult> {
  return postCompareReport('/api/compare/report/json', args)
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

