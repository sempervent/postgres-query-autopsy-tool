import { useVirtualizer } from '@tanstack/react-virtual'
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react'
import { preferredScrollBehavior } from '../presentation/motionPreferences'
import { scheduleVirtualScrollSettled } from './virtualizedScrollSettled'

/** Use windowing only when the list is large enough to matter. */
export const VIRTUAL_LIST_THRESHOLD = 36

export type VirtualizedListColumnHandle = {
  /**
   * Scroll the scroll parent so `index` is visible (Phase 110 triage → virtualized row).
   * When `onSettled` is provided (Phase 128), it runs after the row for `index` appears in
   * `getVirtualItems()` (rAF-based), then one more frame — for reliable post-scroll focus.
   */
  scrollToIndex: (
    index: number,
    opts?: { align?: 'start' | 'center' | 'end' | 'auto' },
    onSettled?: () => void,
  ) => void
}

type VirtualizedListColumnProps = {
  count: number
  /** Default row height estimate when `getItemSize` is omitted. */
  estimateSize: number
  /** Per-index estimate (e.g. header rows shorter than body rows). `measureElement` still refines after paint. */
  getItemSize?: (index: number) => number
  maxHeight?: string
  className?: string
  /** Optional test id on the scroll container (e.g. virtualized suggestions — Phase 113). */
  scrollContainerTestId?: string
  'aria-label'?: string
  children: (index: number) => ReactNode
}

/**
 * Vertical windowing for long lists. Rows use `measureElement` so expandable content (e.g. details) stays usable.
 */
export const VirtualizedListColumn = forwardRef<VirtualizedListColumnHandle, VirtualizedListColumnProps>(
  function VirtualizedListColumn(props, forwardedRef) {
    const {
      count,
      estimateSize,
      getItemSize,
      maxHeight = 'min(560px, max(280px, 58vh))',
      className,
      scrollContainerTestId,
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

    useImperativeHandle(
      forwardedRef,
      () => ({
        scrollToIndex: (index, opts, onSettled) => {
          virtualizer.scrollToIndex(index, {
            align: opts?.align ?? 'center',
            behavior: preferredScrollBehavior(),
          })
          if (!onSettled) return
          scheduleVirtualScrollSettled(() => virtualizer.getVirtualItems(), index, onSettled)
        },
      }),
      [virtualizer],
    )

    const items = virtualizer.getVirtualItems()

    return (
      <div
        ref={parentRef}
        data-testid={scrollContainerTestId}
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
  },
)
