/** Screen-reader keyboard cheat sheet for pin-capable Compare regions (`aria-describedby`). */
export const COMPARE_WORKSPACE_KEYBOARD_HINTS_ID = 'pqat-compare-workspace-keyboard-hints'

export const COMPARE_WORKSPACE_KEYBOARD_HINTS_TEXT =
  'Keyboard: in Index changes, Arrow Up or Down moves between rows; Enter or Space pins for Copy link. In Next steps, Tab to Pin; Arrow Up or Down, Home, or End moves between Pin controls.'

/** Auto-clear for hydrate-only “Opened with …” copy so the live region does not read as sticky status. */
export const COMPARE_PIN_HYDRATE_CLEAR_MS = 4200

/** Stable fingerprint for the single primary Compare link pin (finding vs index vs suggestion vs none). */
export function comparePinLiveFingerprint(
  findingId: string | null,
  indexInsightId: string | null,
  suggestionId: string | null,
): string {
  if (findingId) return `f:${findingId}`
  if (indexInsightId) return `i:${indexInsightId}`
  if (suggestionId) return `s:${suggestionId}`
  return 'none'
}

/** Short polite status line for `aria-live` when the user changes the pin after load. */
export function comparePinAnnouncementForFingerprint(fp: string): string {
  if (fp === 'none') return 'Pin cleared for shared link.'
  if (fp.startsWith('f:')) return 'Finding pinned for shared link.'
  if (fp.startsWith('i:')) return 'Index insight pinned for shared link.'
  if (fp.startsWith('s:')) return 'Next step pinned for shared link.'
  return 'Pinned context updated for shared link.'
}

/** One-time hydrate line when a comparison opens with a valid deep-link pin (distinct from transition copy). */
export function comparePinHydrateAnnouncementForFingerprint(fp: string): string {
  if (fp === 'none') return ''
  if (fp.startsWith('f:')) return 'Opened with finding pinned for shared link.'
  if (fp.startsWith('i:')) return 'Opened with index insight pinned for shared link.'
  if (fp.startsWith('s:')) return 'Opened with next step pinned for shared link.'
  return ''
}
