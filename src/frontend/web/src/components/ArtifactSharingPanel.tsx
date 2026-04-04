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
    <details
      data-testid="artifact-sharing-details"
      className="pqat-sharingDetails pqat-metaPanel"
      aria-label="Artifact sharing"
    >
      <summary>Sharing &amp; access</summary>
      <div className="pqat-sharingDetails__body">
        <div className="pqat-sharingDetails__row">
          <span className="pqat-signalLine__label">Owner</span>{' '}
          <span className="pqat-sharingDetails__mono">{artifactAccess.ownerUserId?.trim() || '—'}</span>
        </div>
        <div>
          <label className="pqat-fieldLabel pqat-fieldLabel--sm" htmlFor={`pqat-share-scope-${artifactId}`}>
            Access scope
          </label>
          <select
            id={`pqat-share-scope-${artifactId}`}
            data-testid="artifact-sharing-access-scope"
            className="pqat-select pqat-select--meta"
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
          <label className="pqat-fieldLabel pqat-fieldLabel--sm pqat-fieldLabel--stack">
            Group ids (comma-separated)
            <input
              data-testid="artifact-sharing-groups-input"
              className="pqat-input pqat-input--meta"
              value={groupsText}
              onChange={(e) => setGroupsText(e.target.value)}
              placeholder="e.g. perf-team, dba"
            />
          </label>
        ) : null}
        <label className="pqat-checkRow pqat-checkRow--meta">
          <input data-testid="artifact-sharing-allow-link" type="checkbox" checked={allowLink} onChange={(e) => setAllowLink(e.target.checked)} />
          <span>Allow link-style access (opaque URL when policy allows)</span>
        </label>
        <div className="pqat-sharingDetails__actions">
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
            <span data-testid="artifact-sharing-status" className="pqat-sharingDetails__status">
              {msg}
            </span>
          ) : null}
        </div>
        <div className="pqat-authHelpCard">
          <p className="pqat-authHelpCard__title">Server &amp; browser</p>
          {authHelp ? <p className="pqat-authHelpCard__text">{authHelp}</p> : null}
          <p className="pqat-authHelpCard__fine">
            The API enforces access on every request. For calls from this browser:{' '}
            {authIdentityKind === 'api_key' ? (
              <>
                set <code className="pqat-codeInline">VITE_AUTH_API_KEY</code> (or{' '}
                <code className="pqat-codeInline">VITE_AUTH_BEARER_TOKEN</code> if your gateway maps it).
              </>
            ) : (
              <>
                set <code className="pqat-codeInline">VITE_AUTH_BEARER_TOKEN</code> (JWT or legacy bearer) or{' '}
                <code className="pqat-codeInline">VITE_AUTH_API_KEY</code> for API-key mode.
              </>
            )}
          </p>
        </div>
      </div>
    </details>
  )
}
