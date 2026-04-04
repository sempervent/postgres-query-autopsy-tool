/**
 * Shared Analyze/Compare persisted + request error banner semantics (Phase 56).
 */

export type ArtifactErrorTone = 'denial' | 'warn' | 'error'

export function artifactErrorTone(message: string): ArtifactErrorTone {
  const m = message.trim()
  if (/access denied/i.test(m)) return 'denial'
  if (/No stored (analysis|comparison) for id/i.test(m)) return 'warn'
  if (/artifact_corrupt|corrupt|unreadable|malformed|422/i.test(m)) return 'warn'
  if (/unsupported|schema|409|incompatible|newer than|artifact_schema/i.test(m)) return 'warn'
  if (/\[Plan A\]|\[Plan B\]|plan_parse|parse failed|PlanParseError|ComparePlanParseError/i.test(m)) return 'warn'
  return 'error'
}

export function artifactErrorBannerToneClass(tone: ArtifactErrorTone): string {
  switch (tone) {
    case 'denial':
      return 'pqat-stateBanner--denial'
    case 'warn':
      return 'pqat-stateBanner--warn'
    case 'error':
      return 'pqat-stateBanner--error'
  }
}

/** Label before the message body (keeps denial/warn/error tone distinct without shouting "Error" for policy blocks). */
export function artifactErrorBodyKicker(tone: ArtifactErrorTone): string {
  switch (tone) {
    case 'denial':
      return 'Policy'
    case 'warn':
      return 'Notice'
    case 'error':
      return 'Error'
  }
}

export function artifactErrorBannerTitle(message: string): string {
  const m = message.trim()
  if (/access denied/i.test(m)) return 'Access blocked'
  if (/No stored analysis for id/i.test(m) || /No stored comparison for id/i.test(m)) return 'Snapshot not found'
  if (/corrupt|unreadable|malformed|422|artifact_corrupt/i.test(m)) return 'Artifact issue'
  if (/unsupported|schema|409|incompatible|newer than|artifact_schema/i.test(m)) return 'Unsupported snapshot version'
  if (/\[Plan A\]|\[Plan B\]/i.test(m)) return 'Plan text issue'
  return 'Could not complete request'
}
