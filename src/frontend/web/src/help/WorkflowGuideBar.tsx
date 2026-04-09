import type { Ref } from 'react'

export type WorkflowGuideBarProps = {
  expanded: boolean
  onToggle: () => void
  toggleCollapsedLabel: string
  toggleExpandedLabel: string
  hint?: string
  /** Short keyboard hint, e.g. "Press ? to reopen" (ignored while typing in inputs). */
  keyboardHint?: string
  /** Return focus here after explicit close (Hide guide, Esc). */
  toggleRef?: Ref<HTMLButtonElement | null>
  /** Native tooltip for discoverability without a legend wall. */
  toggleTitle?: string
  testId?: string
  /** Must match the guide panel `id` for aria-controls. */
  panelId?: string
}

export function WorkflowGuideBar(props: WorkflowGuideBarProps) {
  const {
    expanded,
    onToggle,
    toggleCollapsedLabel,
    toggleExpandedLabel,
    hint,
    keyboardHint,
    toggleRef,
    toggleTitle,
    testId,
    panelId,
  } = props
  return (
    <div className="pqat-help-bar" data-testid={testId}>
      {hint || keyboardHint ? (
        <p className="pqat-help-bar__note" id={`${testId ?? 'workflow-guide'}-hint`}>
          {hint ? <>{hint}</> : null}
          {hint && keyboardHint ? <> · </> : null}
          {keyboardHint ? <span data-testid={`${testId ?? 'workflow-guide'}-kbd-hint`}>{keyboardHint}</span> : null}
        </p>
      ) : null}
      <button
        ref={toggleRef}
        type="button"
        className="pqat-help-bar__toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        title={toggleTitle}
        onClick={onToggle}
      >
        {expanded ? toggleExpandedLabel : toggleCollapsedLabel}
      </button>
    </div>
  )
}
