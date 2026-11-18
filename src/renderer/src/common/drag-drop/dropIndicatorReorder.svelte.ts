import type { DragGhostOptions, DraggableOptions } from './dragDrop.svelte.ts'

/** Boundary a dragged row would drop on: right before or right after one row. */
export type ReorderDropTarget = {
  /** Row the drop indicator is drawn beside. */
  id: string
  /** Whether the boundary follows the row rather than preceding it. */
  after: boolean
}

/** Inputs for drag reordering one keyed list with a drop indicator. */
type DropIndicatorReorderOptions = {
  /** Drag type that keeps this list's rows out of unrelated drop targets. */
  dragType: string
  /** Row IDs in display order. */
  getIds: () => string[]
  /** Boundary under the pointer, or null while the pointer is outside the drop area. */
  getDropTarget: (clientX: number, clientY: number) => ReorderDropTarget | null
  /** Cursor ghost for one dragged row. */
  createGhost: (id: string) => DragGhostOptions
  /** Saves the dragged row right after previousId, or first when it is null, after a drop that changes the order. */
  onReorder: (draggedId: string, previousId: string | null) => void
}

/** Marks where a dragged row would land with a drop indicator and moves it there on drop; rows stay put while dragging. */
export const createDropIndicatorReorder = (options: DropIndicatorReorderOptions) => {
  /** Row currently being dragged, or null while idle. */
  let draggedId = $state<string | null>(null)
  /** Boundary the drop indicator marks, or null while idle or outside the drop area. */
  let dropTarget = $state<ReorderDropTarget | null>(null)

  /** Index of the row a boundary precedes, or the row count after the last row. */
  const getBoundaryIndex = (ids: string[], target: ReorderDropTarget): number =>
    ids.indexOf(target.id) + (target.after ? 1 : 0)

  /** Whether dropping on the current boundary leaves the dragged row where it is. */
  const isBlocked = (): boolean => {
    if (!draggedId || !dropTarget) return false
    const ids = options.getIds()
    /** Dragged row's position, whose own two boundaries change nothing. */
    const draggedIndex = ids.indexOf(draggedId)
    const boundaryIndex = getBoundaryIndex(ids, dropTarget)
    return boundaryIndex === draggedIndex || boundaryIndex === draggedIndex + 1
  }

  return {
    /** Row currently being dragged, or null while idle. */
    get draggedId() {
      return draggedId
    },
    /** Boundary the drop indicator marks, or null while idle or outside the drop area. */
    get dropTarget() {
      return dropTarget
    },
    /** Whether the drop indicator is gray because dropping would change nothing. */
    get isBlocked() {
      return isBlocked()
    },
    /** Draggable action options for one row. */
    getDraggableOptions: (id: string): DraggableOptions<string> => ({
      dragType: options.dragType,
      payload: id,
      createGhost: options.createGhost,
      onDragStart: () => {
        draggedId = id
      },
      onDragMove: (_, clientX, clientY) => {
        /** Boundary under the pointer, assigned only when it changes to avoid redrawing on every move. */
        const nextTarget = options.getDropTarget(clientX, clientY)
        if (nextTarget?.id !== dropTarget?.id || nextTarget?.after !== dropTarget?.after) dropTarget = nextTarget
      },
      onDragFinish: ({ cancelled }) => {
        /** Boundary and no-op state captured before the drag state clears. */
        const target = dropTarget
        const blocked = isBlocked()
        draggedId = null
        dropTarget = null
        if (cancelled || !target || blocked) return
        const ids = options.getIds()
        options.onReorder(id, ids[getBoundaryIndex(ids, target) - 1] ?? null)
      }
    })
  }
}
