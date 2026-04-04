import type { CSSProperties, ReactNode } from 'react'

/**
 * Stable chrome for lazy-loaded heavy panels: optional header + reserved body.
 * Phase 45 — pairs with Suspense fallbacks for progressive hydration.
 */
export function HeavyPanelShell(props: {
  eyebrow?: string
  title: string
  className?: string
  style?: CSSProperties
  'aria-label'?: string
  headerActions?: ReactNode
  children: ReactNode
}) {
  const { eyebrow, title, className, style, 'aria-label': aria, headerActions, children } = props
  return (
    <div
      className={['pqat-panel pqat-panel--detail pqat-heavyPanel pqat-workspaceReveal', className].filter(Boolean).join(' ')}
      style={style}
      aria-label={aria}
    >
      <div className="pqat-heavyPanel__header">
        <div>
          {eyebrow ? <p className="pqat-heavyPanel__eyebrow">{eyebrow}</p> : null}
          <h2 className="pqat-heavyPanel__title">{title}</h2>
        </div>
        {headerActions ? <div className="pqat-heavyPanel__actions">{headerActions}</div> : null}
      </div>
      <div className="pqat-heavyPanel__body">{children}</div>
    </div>
  )
}

export function LowerBandPanelSkeleton(props: { title: string; eyebrow?: string; lines?: number }) {
  const { title, eyebrow = 'Loading', lines = 5 } = props
  return (
    <HeavyPanelShell eyebrow={eyebrow} title={title} aria-label={`${title} loading`}>
      <div className="pqat-panelSkeleton" role="status" aria-busy="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="pqat-panelSkeleton__row" style={{ width: `${68 + (i % 4) * 8}%` }} />
        ))}
      </div>
    </HeavyPanelShell>
  )
}
