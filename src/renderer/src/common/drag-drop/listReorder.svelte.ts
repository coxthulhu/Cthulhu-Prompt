import type { DraggableOptions } from './dragDrop.svelte.ts'

/** Inputs for live drag reordering of one vertical keyed list. */
type ListReorderOptions = {
  /** Drag type that keeps this list's rows out of unrelated drop targets. */
  dragType: string
  /** Committed row IDs in display order. */
  getIds: () => string[]
  /** Stationary row container that owns pointer capture and defines the drop area. */
  getListElement: () => HTMLElement | undefined
  /** Receives the complete new order after a drop changes it; a returned promise keeps the preview until it settles. */
  onReorder: (ids: string[]) => void | Promise<unknown>
}

/** Previews a dragged row's new position live and commits on drop, matching the Show All collection dropdown. */
export const createListReorder = (options: ListReorderOptions) => {
  /** Row currently being dragged, or null while idle. */
  let draggedId = $state<string | null>(null)
  /** Committed order captured when the drag started. */
  let sourceIds: string[] = []
  /** Displayed order while dragging and until a committed reorder settles. */
  let previewIds = $state<string[] | null>(null)

  /** Resolves the hovered row slot, or null while the pointer is outside the list. */
  const getTargetIndex = (clientX: number, clientY: number): number | null => {
    /** Row container measured with its own scroll offset. */
    const list = options.getListElement()!
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
        /** Order with the dragged row in the hovered slot, or back in its original slot outside the list. */
        const nextIds = sourceIds.filter((sourceId) => sourceId !== id)
        nextIds.splice(getTargetIndex(clientX, clientY) ?? sourceIds.indexOf(id), 0, id)
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
        void Promise.resolve(options.onReorder(committedIds)).finally(() => {
          if (previewIds === committedIds) previewIds = null
        })
      }
    })
  }
}
