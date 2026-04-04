import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

export type ClickableRowSelectedEmphasis = 'fill' | 'accent-bar'

export type ClickableRowProps = {
  onActivate: () => void
  children: ReactNode
  selected?: boolean
  /** How selection is shown when `selected` is true. `fill` tints the row; `accent-bar` keeps your background and adds a left accent bar (e.g. tinted callout cards). */
  selectedEmphasis?: ClickableRowSelectedEmphasis
  /** Fired on mouse enter and focus — for lightweight prefetch (e.g. lazy pair detail) without blocking activate. */
  onPointerIntent?: () => void
  style?: CSSProperties
  className?: string
  'aria-label'?: string
}

/**
 * Row-level navigation target with inner action buttons (e.g. Copy).
 * Uses role="button" + keyboard activation so inner controls can be real buttons.
 */
export function ClickableRow({
  onActivate,
  children,
  selected,
  selectedEmphasis = 'fill',
  onPointerIntent,
  style,
  className,
  'aria-label': ariaLabel,
}: ClickableRowProps) {
  const selectedStyle: CSSProperties | undefined =
    selected === true
      ? selectedEmphasis === 'accent-bar'
        ? {
            border: '1px solid var(--accent-border)',
            boxShadow: 'inset 3px 0 0 0 var(--accent-border)',
          }
        : {
            border: '1px solid var(--accent-border)',
            background: 'color-mix(in srgb, var(--accent-bg) 28%, transparent)',
          }
      : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={['clickableRow', selected ? 'clickableRow--selected' : '', className].filter(Boolean).join(' ')}
      onMouseEnter={() => onPointerIntent?.()}
      onFocus={() => onPointerIntent?.()}
      onClick={() => onActivate()}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      style={{
        cursor: 'pointer',
        textAlign: 'left',
        outline: 'none',
        ...style,
        ...selectedStyle,
      }}
    >
      {children}
    </div>
  )
}
