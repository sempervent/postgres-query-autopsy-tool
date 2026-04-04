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
    <details style={{ marginTop: 12 }} aria-label="Artifact sharing">
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Sharing</summary>
      <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <span style={{ opacity: 0.85 }}>Owner</span>{' '}
          <span style={{ fontFamily: 'var(--mono)' }}>{artifactAccess.ownerUserId?.trim() || '—'}</span>
        </div>
        <div>
          <span style={{ opacity: 0.85, display: 'block', marginBottom: 4 }}>Access scope</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'inherit' }}
          >
            <option value="private">private (owner only)</option>
            <option value="link">link (capability URL when link access is on)</option>
            <option value="group">group (listed groups)</option>
            <option value="public">public (any signed-in user)</option>
          </select>
        </div>
        {scope === 'group' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ opacity: 0.85 }}>Group ids (comma-separated)</span>
            <input
              value={groupsText}
              onChange={(e) => setGroupsText(e.target.value)}
              placeholder="e.g. perf-team, dba"
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 12 }}
            />
          </label>
        ) : null}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={allowLink} onChange={(e) => setAllowLink(e.target.checked)} />
          Allow link-style access (opaque URL works for others when policy allows)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            style={{ padding: '6px 12px', borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save sharing'}
          </button>
          {msg ? <span style={{ fontSize: 12, opacity: 0.9 }}>{msg}</span> : null}
        </div>
        <div style={{ fontSize: 11, opacity: 0.78 }}>
          {authHelp ? <p style={{ margin: '0 0 6px' }}>{authHelp}</p> : null}
          <p style={{ margin: 0 }}>
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
