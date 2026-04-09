import { useCallback } from 'react'
import { useCopyFeedback } from '../presentation/useCopyFeedback'
import { buildCopyGuidedLinkUrlFromLocation } from './workflowGuideEntryUrl'

export function WorkflowGuideCopyGuidedRow(props: { testId: string }) {
  const guidedCopy = useCopyFeedback()
  const onCopy = useCallback(async () => {
    if (typeof window === 'undefined') return
    const url = buildCopyGuidedLinkUrlFromLocation(window.location)
    await guidedCopy.copy(url, 'Copied guided link')
  }, [guidedCopy])

  return (
    <div className="pqat-help-shell__support" data-testid={props.testId}>
      <div className="pqat-help-shell__supportRow">
        <button
          type="button"
          className="pqat-btn pqat-btn--sm pqat-btn--ghost"
          title="Copies this page’s URL with guide=1 merged in (keeps other query params). For onboarding—not the same as Copy link on a saved artifact."
          onClick={() => void onCopy()}
        >
          Copy guided link
        </button>
        {guidedCopy.status ? (
          <span role="status" aria-live="polite" className="pqat-help-shell__supportStatus">
            {guidedCopy.status}
          </span>
        ) : null}
      </div>
      <p className="pqat-help-shell__supportHint">
        Adds or updates <code>guide=1</code> on the <strong>current address</strong> (other params kept). Opens the workflow guide; use <strong>Copy link</strong> in the workspace when you need a saved analysis/compare snapshot.
      </p>
    </div>
  )
}
