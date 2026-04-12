import { useCallback } from 'react'
import { useCopyFeedback } from '../presentation/useCopyFeedback'
import { buildCopyGuidedLinkUrlFromLocation, buildWorkflowGuideAbsoluteUrl } from './workflowGuideEntryUrl'

export function WorkflowGuideCopyGuidedRow(props: { testId: string }) {
  const guidedCopy = useCopyFeedback()
  const onCopyMerged = useCallback(async () => {
    if (typeof window === 'undefined') return
    const url = buildCopyGuidedLinkUrlFromLocation(window.location)
    await guidedCopy.copy(url, 'Copied merged guided link')
  }, [guidedCopy])

  const onCopyEntry = useCallback(async () => {
    if (typeof window === 'undefined') return
    const url = buildWorkflowGuideAbsoluteUrl(window.location.pathname)
    await guidedCopy.copy(url, 'Copied entry guided link')
  }, [guidedCopy])

  return (
    <div className="pqat-help-shell__support" data-testid={props.testId}>
      <div className="pqat-help-shell__supportRow">
        <button
          type="button"
          data-testid={`${props.testId}-merged`}
          className="pqat-btn pqat-btn--sm pqat-btn--ghost"
          aria-label="Merged guided link: current URL plus guide equals 1 (keeps query and hash) so the recipient sees this same context with help open"
          title="Merged: same address bar + guide=1. Use when someone should land in this exact view (pins, comparison=, analysis=, etc.). Not workspace Copy link."
          onClick={() => void onCopyMerged()}
        >
          Copy merged guided link
        </button>
        <button
          type="button"
          data-testid={`${props.testId}-entry`}
          className="pqat-btn pqat-btn--sm pqat-btn--ghost"
          aria-label="Entry guided link: only guide equals 1 on this route—drops other query parameters and hash"
          title="Entry: path + ?guide=1 only. Use for generic onboarding or docs—not for reproducing a pinned snapshot. Not workspace Copy link."
          onClick={() => void onCopyEntry()}
        >
          Copy entry guided link
        </button>
        {guidedCopy.status ? (
          <span role="status" aria-live="polite" className="pqat-help-shell__supportStatus">
            {guidedCopy.status}
          </span>
        ) : null}
      </div>
      <p className="pqat-help-shell__supportHint">
        <strong>Merged</strong> = full URL + <code>guide=1</code> (keeps this context). <strong>Entry</strong> = route + <code>?guide=1</code> only (clean start). Saved artifacts: use{' '}
        <strong>Copy link</strong> / <strong>Copy share link</strong> in the workspace.
      </p>
    </div>
  )
}
