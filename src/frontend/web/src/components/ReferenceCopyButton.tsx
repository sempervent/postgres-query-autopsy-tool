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
      className="pqat-copyBtn"
      style={style}
    >
      {label}
    </button>
  )
}
