import { useEffect, useState } from 'react'
import type { StoredArtifactAccess } from '../api/types'
import { updateAnalysisSharing, updateComparisonSharing } from '../api/client'

type Props = {
  authEnabled: boolean
  /** From GET /api/config (Phase 38). */
  authIdentityKind?: string
  authHelp?: string
  kind: 'analysis' | 'comparison'
  artifactId: string
  artifactAccess: StoredArtifactAccess | null | undefined
  onSaved: () => void | Promise<void>
}

const SCOPES = ['link', 'private', 'group', 'public'] as const

export function ArtifactSharingPanel({
  authEnabled,
  authIdentityKind,
  authHelp,
  kind,
  artifactId,
  artifactAccess,
  onSaved,
}: Props) {
  const [scope, setScope] = useState<string>('private')
  const [groupsText, setGroupsText] = useState('')
  const [allowLink, setAllowLink] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!artifactAccess) return
    setScope(SCOPES.includes(artifactAccess.accessScope as (typeof SCOPES)[number]) ? artifactAccess.accessScope : 'private')
    setGroupsText(artifactAccess.sharedGroupIds.join(', '))
    setAllowLink(artifactAccess.allowLinkAccess)
    setMsg(null)
  }, [artifactAccess])

  if (!authEnabled || !artifactAccess) return null

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const sharedGroupIds =
        scope === 'group'
          ? groupsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []
      if (kind === 'analysis') {
        await updateAnalysisSharing(artifactId, { accessScope: scope, sharedGroupIds, allowLinkAccess: allowLink })
      } else {
        await updateComparisonSharing(artifactId, { accessScope: scope, sharedGroupIds, allowLinkAccess: allowLink })
      }
      await onSaved()
      setMsg('Saved.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <details data-testid="artifact-sharing-details" className="pqat-sharingDetails" aria-label="Artifact sharing">
      <summary>Sharing &amp; access</summary>
      <div className="pqat-sharingDetails__body">
        <div>
          <span className="pqat-signalLine__label">Owner</span>{' '}
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-h)' }}>
            {artifactAccess.ownerUserId?.trim() || '—'}
          </span>
        </div>
        <div>
          <label className="pqat-fieldLabel pqat-fieldLabel--sm" htmlFor={`pqat-share-scope-${artifactId}`}>
            Access scope
          </label>
          <select
            id={`pqat-share-scope-${artifactId}`}
            data-testid="artifact-sharing-access-scope"
            className="pqat-select"
            style={{ marginTop: 6, maxWidth: '100%' }}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="private">private (owner only)</option>
            <option value="link">link (capability URL when link access is on)</option>
            <option value="group">group (listed groups)</option>
            <option value="public">public (any signed-in user)</option>
          </select>
        </div>
        {scope === 'group' ? (
          <label className="pqat-fieldLabel pqat-fieldLabel--sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            Group ids (comma-separated)
            <input
              data-testid="artifact-sharing-groups-input"
              className="pqat-input"
              value={groupsText}
              onChange={(e) => setGroupsText(e.target.value)}
              placeholder="e.g. perf-team, dba"
              style={{ fontFamily: 'var(--mono)', fontSize: '0.8125rem' }}
            />
          </label>
        ) : null}
        <label className="pqat-checkRow" style={{ cursor: 'pointer', marginTop: 2 }}>
          <input data-testid="artifact-sharing-allow-link" type="checkbox" checked={allowLink} onChange={(e) => setAllowLink(e.target.checked)} />
          <span>Allow link-style access (opaque URL when policy allows)</span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            data-testid="artifact-sharing-save"
            type="button"
            className="pqat-btn pqat-btn--primary pqat-btn--sm"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save sharing'}
          </button>
          {msg ? (
            <span data-testid="artifact-sharing-status" className="pqat-hint" style={{ margin: 0, color: 'var(--text-h)' }}>
              {msg}
            </span>
          ) : null}
        </div>
        <div className="pqat-stateBanner pqat-stateBanner--info" style={{ marginTop: 4, padding: '10px 12px' }}>
          {authHelp ? <p style={{ margin: '0 0 8px', color: 'var(--text)' }}>{authHelp}</p> : null}
          <p style={{ margin: 0, fontSize: '0.6875rem', lineHeight: 1.45, color: 'var(--text-secondary)' }}>
            Server enforces access. For browser calls:{' '}
            {authIdentityKind === 'api_key' ? (
              <>
                set <span style={{ fontFamily: 'var(--mono)' }}>VITE_AUTH_API_KEY</span> (or{' '}
                <span style={{ fontFamily: 'var(--mono)' }}>VITE_AUTH_BEARER_TOKEN</span> if your gateway maps it).
              </>
            ) : (
              <>
                set <span style={{ fontFamily: 'var(--mono)' }}>VITE_AUTH_BEARER_TOKEN</span> (JWT or legacy bearer) or{' '}
                <span style={{ fontFamily: 'var(--mono)' }}>VITE_AUTH_API_KEY</span> for API-key mode.
              </>
            )}
          </p>
        </div>
      </div>
    </details>
  )
}
