import type { CSSProperties } from 'react'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type RowProps<T extends string> = {
  id: T
  label: string
  index: number
  length: number
  onMoveUp: (i: number) => void
  onMoveDown: (i: number) => void
}

function SortableOrderRow<T extends string>(props: RowProps<T>) {
  const { id, label, index, length, onMoveUp, onMoveDown } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      role="listitem"
      className={`pqat-sortRow${isDragging ? ' pqat-sortRow--dragging' : ''}`}
    >
      <button
        type="button"
        className="pqat-dragHandle"
        aria-label={`Drag to reorder: ${label}`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⣿
      </button>
      <span className="pqat-sortRow__label">{label}</span>
      <button
        type="button"
        className="pqat-btn pqat-btn--sm pqat-btn--ghost pqat-sortRow__btnDimmed"
        disabled={index === 0}
        onClick={() => onMoveUp(index)}
      >
        Up
      </button>
      <button
        type="button"
        className="pqat-btn pqat-btn--sm pqat-btn--ghost pqat-sortRow__btnDimmed"
        disabled={index >= length - 1}
        onClick={() => onMoveDown(index)}
      >
        Down
      </button>
    </div>
  )
}

export type WorkspaceSortableOrderListProps<T extends string> = {
  /** Stable string ids (must match layout model ids). */
  items: readonly T[]
  getLabel: (id: T) => string
  onReorder: (next: T[]) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  /** Accessible name for the list */
  ariaLabel: string
}

export function WorkspaceSortableOrderList<T extends string>(props: WorkspaceSortableOrderListProps<T>) {
  const { items, getLabel, onReorder, onMoveUp, onMoveDown, ariaLabel } = props
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.indexOf(active.id as T)
    const newIndex = items.indexOf(over.id as T)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove([...items], oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={[...items]} strategy={verticalListSortingStrategy}>
        <div className="pqat-sortList" role="list" aria-label={ariaLabel}>
          {items.map((id, i) => (
            <SortableOrderRow
              key={id}
              id={id}
              label={getLabel(id)}
              index={i}
              length={items.length}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
