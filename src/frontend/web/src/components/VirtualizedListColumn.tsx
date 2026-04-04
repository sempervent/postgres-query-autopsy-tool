import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type ReactNode } from 'react'

/** Use windowing only when the list is large enough to matter. */
export const VIRTUAL_LIST_THRESHOLD = 36

type VirtualizedListColumnProps = {
  count: number
  /** Default row height estimate when `getItemSize` is omitted. */
  estimateSize: number
  /** Per-index estimate (e.g. header rows shorter than body rows). `measureElement` still refines after paint. */
  getItemSize?: (index: number) => number
  maxHeight?: string
  className?: string
  'aria-label'?: string
  children: (index: number) => ReactNode
}

/**
 * Vertical windowing for long lists. Rows use `measureElement` so expandable content (e.g. details) stays usable.
 */
export function VirtualizedListColumn(props: VirtualizedListColumnProps) {
  const {
    count,
    estimateSize,
    getItemSize,
    maxHeight = 'min(560px, max(280px, 58vh))',
    className,
    'aria-label': ariaLabel,
    children,
  } = props
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (getItemSize ? getItemSize(i) : estimateSize),
    overscan: 8,
  })

  const items = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className={className}
      style={{
        maxHeight,
        minHeight: 240,
        overflow: 'auto',
        minWidth: 0,
      }}
      aria-label={ariaLabel}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {children(virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
