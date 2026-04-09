import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { workflowGuideFocusLoopKeydownHandler } from './workflowGuideFocusLoopHelpers'

export type WorkflowGuideShellProps = {
  titleId: string
  panelId?: string
  kicker?: string
  title: ReactNode
  lede?: ReactNode
  children: ReactNode
  /** Support row (e.g. copy guided link)—kept in help chrome, not mixed into analysis panels. */
  footer?: ReactNode
  /** Tab wraps between first/last focusable inside the shell (explicit opens only). */
  keyboardContain?: boolean
  testId?: string
}

/** Visually distinct from pqat investigation panels — guide / onboarding only. */
export function WorkflowGuideShell(props: WorkflowGuideShellProps) {
  const { titleId, panelId, kicker = 'Guide — not plan analysis', title, lede, children, footer, keyboardContain, testId } = props
  const shellRef = useRef<HTMLElement | null>(null)
  const keyboardContainRef = useRef(keyboardContain)
  keyboardContainRef.current = keyboardContain

  useEffect(() => {
    const root = shellRef.current
    if (!root || !keyboardContain) return
    const onKey = (e: KeyboardEvent) => {
      if (!keyboardContainRef.current) return
      workflowGuideFocusLoopKeydownHandler(root, e)
    }
    root.addEventListener('keydown', onKey, true)
    return () => root.removeEventListener('keydown', onKey, true)
  }, [keyboardContain])

  return (
    <section
      ref={shellRef}
      className="pqat-help-shell"
      id={panelId}
      data-testid={testId}
      data-pqat-help-surface="1"
      aria-labelledby={titleId}
    >
        <p className="pqat-help-shell__kicker">{kicker}</p>
        <h2 className="pqat-help-shell__title" id={titleId} tabIndex={0}>
          {title}
        </h2>
        {lede ? <p className="pqat-help-shell__lede">{lede}</p> : null}
        <div className="pqat-help-shell__body">{children}</div>
      {footer ? <div className="pqat-help-shell__footer">{footer}</div> : null}
    </section>
  )
}
