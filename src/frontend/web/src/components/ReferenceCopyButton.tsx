import type { CSSProperties, MouseEvent } from 'react'

export type ReferenceCopyButtonProps = {
  onCopy: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>
  label?: string
  'aria-label'?: string
  style?: CSSProperties
}

/** Small secondary copy affordance; always a real &lt;button&gt; (never nested in another button). */
export function ReferenceCopyButton({
  onCopy,
  label = 'Copy',
  'aria-label': ariaLabel,
  style,
}: ReferenceCopyButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        void onCopy(e)
      }}
      aria-label={ariaLabel ?? label}
      style={{
        padding: '4px 8px',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 12,
        opacity: 0.9,
        border: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        color: 'var(--text-h)',
        ...style,
      }}
    >
      {label}
    </button>
  )
}
