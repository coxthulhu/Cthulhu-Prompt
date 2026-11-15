import type { DraggableOptions } from './dragDrop.svelte.ts'

/** Inputs for live drag reordering of one keyed list. */
type ListReorderOptions = {
  /** Drag type that keeps this list's rows out of unrelated drop targets. */
  dragType: string
  /** Committed row IDs in display order. */
  getIds: () => string[]
  /** Stationary container of equal-height rows that defines the drop area; unused when getTargetIndex is supplied. */
  getListElement?: () => HTMLElement | undefined
  /** Replaces the equal-height row hit test: the dragged row's slot under the pointer, or null to leave it in place. */
  getTargetIndex?: (clientX: number, clientY: number) => number | null
  /**
   * Receives the complete new order, the dragged row, and the row now before it (null when first) after a drop
   * changes the order; a returned promise keeps the preview until it settles.
   */
  onReorder: (ids: string[], draggedId: string, previousId: string | null) => void | Promise<unknown>
}

/** Previews a dragged row's new position live and commits on drop, matching the Show All collection dropdown. */
export const createListReorder = (options: ListReorderOptions) => {
  /** Row currently being dragged, or null while idle. */
  let draggedId = $state<string | null>(null)
  /** Committed order captured when the drag started. */
  let sourceIds: string[] = []
  /** Displayed order while dragging and until a committed reorder settles. */
  let previewIds = $state<string[] | null>(null)

  /** Resolves the hovered row slot of equal-height rows, or null while the pointer is outside the list. */
  const getRowTargetIndex = (clientX: number, clientY: number): number | null => {
    /** Row container measured with its own scroll offset. */
    const list = options.getListElement!()!
    if (!document.elementsFromPoint(clientX, clientY).some((element) => list.contains(element))) return null
    /** Untransformed row height plus the list gap, so flip animations do not disturb hit testing. */
    const rowPitch = (list.firstElementChild as HTMLElement).offsetHeight + parseFloat(getComputedStyle(list).rowGap)
    /** Pointer offset from the top of the list's content. */
    const contentY = clientY - list.getBoundingClientRect().top + list.scrollTop
    return Math.max(0, Math.min(Math.floor(contentY / rowPitch), sourceIds.length - 1))
  }

  return {
    /** Row currently being dragged, or null while idle. */
    get draggedId() {
      return draggedId
    },
    /** Orders rows by the live preview while one exists. */
    sort: <TItem extends { id: string }>(items: TItem[]): TItem[] =>
      previewIds ? previewIds.map((id) => items.find((item) => item.id === id)!) : items,
    /** Draggable action options for one row. */
    getDraggableOptions: (id: string): DraggableOptions<string> => ({
      dragType: options.dragType,
      payload: id,
      onDragStart: () => {
        draggedId = id
        // A pending save's preview is the newest order; copying it gives this drag its own preview identity.
        sourceIds = [...(previewIds ?? options.getIds())]
        previewIds = sourceIds
      },
      onDragMove: (_, clientX, clientY) => {
        /** Hovered slot; the built-in hit test returns the row to its original slot outside the list. */
        const targetIndex = options.getTargetIndex
          ? options.getTargetIndex(clientX, clientY)
          : (getRowTargetIndex(clientX, clientY) ?? sourceIds.indexOf(id))
        if (targetIndex === null) return
        /** Order with the dragged row in the target slot. */
        const nextIds = sourceIds.filter((sourceId) => sourceId !== id)
        nextIds.splice(targetIndex, 0, id)
        if (nextIds.join() !== previewIds!.join()) previewIds = nextIds
      },
      onDragFinish: ({ cancelled }) => {
        draggedId = null
        /** Preview committed by this drop, cleared after its save only if no later drag replaced it. */
        const committedIds = previewIds!
        if (cancelled || committedIds.join() === sourceIds.join()) {
          previewIds = null
          return
        }
        void Promise.resolve(
          options.onReorder(committedIds, id, committedIds[committedIds.indexOf(id) - 1] ?? null)
        ).finally(() => {
          if (previewIds === committedIds) previewIds = null
        })
      }
    })
  }
}
