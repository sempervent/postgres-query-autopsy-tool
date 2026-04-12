/**
 * Phase 121 — unified export success copy for Analyze + Compare (saved snapshot vs rebuild-from-text).
 * Phase 135 — optional clause when the snapshot was opened from a saved artifact link (same notion as **— reopened** cues).
 */

export type ExportSuccessSource = 'snapshot' | 'fromPlanText'

export type ExportDownloadSuccessOptions = {
  /** `?analysis=` / `?comparison=` load with empty plan boxes — aligns with ranked/pair reopened tone. */
  restoredFromLink?: boolean
}

/** Single status line after a successful export download is triggered. */
export function exportDownloadSuccessHint(
  source: ExportSuccessSource,
  opts?: ExportDownloadSuccessOptions,
): string {
  const tail = ' If nothing appears, check your browser’s download settings.'
  if (source === 'snapshot') {
    const body =
      opts?.restoredFromLink === true
        ? 'It matches this reopened snapshot — same rows as the saved link.'
        : 'It matches what’s on screen.'
    return `Download should start shortly — ${body}${tail}`
  }
  return `Download should start shortly — built from the plan text in the boxes.${tail}`
}
