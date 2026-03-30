import type { Snippet } from 'svelte'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

const DRAG_START_DISTANCE_PX = 4
const OVERLAY_OFFSET_X_PX = 12

export type DragDropPreview = Snippet<[]>
export type DroppableEdge = 'top' | 'bottom'
export type DroppableAllowedEdges = 'none' | 'top' | 'bottom' | 'top-and-bottom'
type DroppablePayloadResolver = (edge: DroppableEdge | null) => unknown

export type DraggableOptions = {
  dragType: string
  payload: unknown
  previewSnippet: DragDropPreview
  onDragFinish?: (result: { sourcePayload: unknown; dropPayload: unknown | null }) => void
}

export type DroppableOptions = {
  dragType: string
  payload?: unknown | DroppablePayloadResolver
  allowedEdges?: DroppableAllowedEdges
  onDrop?: (payload: unknown) => void
  state?: DroppableState
}

export type DroppableState = {
  isOver: boolean
  edge: DroppableEdge | null
}

export type DroppableStateRegistry<TKey extends string = string> = {
  getState: (key: TKey) => DroppableState
  isOver: (key: TKey) => boolean
  edge: (key: TKey) => DroppableEdge | null
}

type ActiveDrag = {
  sourceNode: HTMLElement
  dragType: string
  payload: unknown
  previewSnippet: DragDropPreview
  onDragFinish: ((result: { sourcePayload: unknown; dropPayload: unknown | null }) => void) | null
  cursorStyleElement: HTMLStyleElement | null
}

type DroppableRegistration = {
  node: HTMLElement
  getOptions: () => DroppableOptions
}

type ActiveDropTarget = {
  registration: DroppableRegistration
  edge: DroppableEdge | null
}

let activeDrag = $state<ActiveDrag | null>(null)
let cursorX = $state(0)
let cursorY = $state(0)
let activeDropTarget: ActiveDropTarget | null = null
const droppableRegistrations = new SvelteSet<DroppableRegistration>()
const droppableRegistrationByNode = new WeakMap<HTMLElement, DroppableRegistration>()

export const createDroppableStateRegistry = <
  TKey extends string
>(): DroppableStateRegistry<TKey> => {
  const stateByKey = new SvelteMap<TKey, DroppableState>()
  const isOverByKey = new SvelteMap<TKey, boolean>()
  const edgeByKey = new SvelteMap<TKey, DroppableEdge>()

  const getState = (key: TKey): DroppableState => {
    const existingState = stateByKey.get(key)
    if (existingState) {
      return existingState
    }

    const nextState = {
      get isOver() {
        return isOverByKey.get(key) ?? false
      },
      set isOver(value: boolean) {
        if (value) {
          isOverByKey.set(key, true)
          return
        }

        isOverByKey.delete(key)
      },
      get edge() {
        return edgeByKey.get(key) ?? null
      },
      set edge(value: DroppableEdge | null) {
        if (value) {
          edgeByKey.set(key, value)
          return
        }

        edgeByKey.delete(key)
      }
    } satisfies DroppableState

    stateByKey.set(key, nextState)
    return nextState
  }

  return {
    getState,
    isOver: (key: TKey) => isOverByKey.get(key) ?? false,
    edge: (key: TKey) => edgeByKey.get(key) ?? null
  }
}

const setDroppableState = (dropTarget: ActiveDropTarget | null, isOver: boolean): void => {
  const dropState = dropTarget?.registration.getOptions().state
  if (dropState) {
    dropState.isOver = isOver
    dropState.edge = isOver ? dropTarget.edge : null
  }
}

const areSameActiveDropTarget = (
  left: ActiveDropTarget | null,
  right: ActiveDropTarget | null
): boolean => {
  return left?.registration === right?.registration && left?.edge === right?.edge
}

const setActiveDropTarget = (nextDropTarget: ActiveDropTarget | null): void => {
  if (areSameActiveDropTarget(activeDropTarget, nextDropTarget)) {
    return
  }

  setDroppableState(activeDropTarget, false)
  activeDropTarget = nextDropTarget
  setDroppableState(activeDropTarget, true)
}

const createDragCursorStyleElement = (node: HTMLElement): HTMLStyleElement | null => {
  const activeDocument = node.ownerDocument
  if (!activeDocument.head) {
    return null
  }

  const style = activeDocument.createElement('style')
  style.textContent = '* { cursor: grabbing !important; }'
  activeDocument.head.appendChild(style)
  return style
}

const getClosestRegisteredDroppable = (
  startElement: Element | null,
  dragType: string
): DroppableRegistration | null => {
  let currentElement = startElement

  while (currentElement instanceof HTMLElement) {
    const registration = droppableRegistrationByNode.get(currentElement)
    if (registration && registration.getOptions().dragType === dragType) {
      return registration
    }

    currentElement = currentElement.parentElement
  }

  return null
}

const getDropTargetFromPoint = (
  x: number,
  y: number,
  dragType: string
): ActiveDropTarget | null => {
  for (const element of document.elementsFromPoint(x, y)) {
    const registration = getClosestRegisteredDroppable(
      element instanceof Element ? element : null,
      dragType
    )
    if (registration) {
      const { allowedEdges = 'none' } = registration.getOptions()
      const edge =
        allowedEdges === 'top'
          ? 'top'
          : allowedEdges === 'bottom'
            ? 'bottom'
            : allowedEdges === 'top-and-bottom'
              ? y < registration.node.getBoundingClientRect().top +
                  registration.node.getBoundingClientRect().height / 2
                ? 'top'
                : 'bottom'
              : null

      return {
        registration,
        edge
      }
    }
  }

  return null
}

const updateActiveDropTarget = (): void => {
  if (!activeDrag) {
    setActiveDropTarget(null)
    return
  }

  const matchedDropTarget = getDropTargetFromPoint(cursorX, cursorY, activeDrag.dragType)

  setActiveDropTarget(matchedDropTarget)
}

const clearActiveDrag = (): void => {
  activeDrag = null
  setActiveDropTarget(null)
}

const restoreDocumentDragState = (): void => {
  document.body.style.userSelect = ''
}

const updateDragCursor = (nextX: number, nextY: number): void => {
  cursorX = nextX
  cursorY = nextY
  updateActiveDropTarget()
}

const beginDrag = (
  sourceNode: HTMLElement,
  options: DraggableOptions,
  startX: number,
  startY: number
): void => {
  activeDrag = {
    sourceNode,
    dragType: options.dragType,
    payload: options.payload,
    previewSnippet: options.previewSnippet,
    onDragFinish: options.onDragFinish ?? null,
    cursorStyleElement: createDragCursorStyleElement(sourceNode)
  }

  updateDragCursor(startX, startY)
  document.body.style.userSelect = 'none'
}

const finishDrag = (): {
  activeDrag: ActiveDrag | null
  activeDropTarget: ActiveDropTarget | null
} => {
  const currentActiveDrag = activeDrag
  const currentActiveDropTarget = activeDropTarget

  clearActiveDrag()
  restoreDocumentDragState()
  currentActiveDrag?.cursorStyleElement?.remove()

  return {
    activeDrag: currentActiveDrag,
    activeDropTarget: currentActiveDropTarget
  }
}

const resolveDropPayload = (dropTarget: ActiveDropTarget | null): unknown | null => {
  const payload = dropTarget?.registration.getOptions().payload
  if (typeof payload === 'function') {
    return payload(dropTarget?.edge ?? null) ?? null
  }

  return payload ?? null
}

const endDrag = (): void => {
  const { activeDrag: completedDrag, activeDropTarget: completedDropTarget } = finishDrag()

  if (!completedDrag) {
    return
  }

  const dropPayload = resolveDropPayload(completedDropTarget)
  completedDropTarget?.registration.getOptions().onDrop?.(completedDrag.payload)
  completedDrag.onDragFinish?.({
    sourcePayload: completedDrag.payload,
    dropPayload
  })
}

export const draggable = (node: HTMLElement, options: DraggableOptions) => {
  let draggableOptions = options

  const handleNativeDragStart = (event: DragEvent) => {
    event.preventDefault()
  }

  const handleMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || activeDrag) {
      return
    }

    const startX = event.clientX
    const startY = event.clientY
    let hasStartedDrag = false

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!hasStartedDrag) {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY
        if (deltaX * deltaX + deltaY * deltaY < DRAG_START_DISTANCE_PX * DRAG_START_DISTANCE_PX) {
          return
        }

        beginDrag(node, draggableOptions, moveEvent.clientX, moveEvent.clientY)
        hasStartedDrag = true
      } else {
        updateDragCursor(moveEvent.clientX, moveEvent.clientY)
      }

      moveEvent.preventDefault()
    }

    const cleanupPointerListeners = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    const handleMouseUp = () => {
      cleanupPointerListeners()

      if (hasStartedDrag) {
        endDrag()
      }
    }

    // Side effect: track the pointer on the window only for the active press.
    window.addEventListener('mousemove', handleMouseMove, { passive: false })
    window.addEventListener('mouseup', handleMouseUp)
  }

  node.draggable = false
  node.addEventListener('dragstart', handleNativeDragStart)
  node.addEventListener('mousedown', handleMouseDown)

  return {
    update(nextOptions: DraggableOptions) {
      draggableOptions = nextOptions
    },
    destroy() {
      node.removeEventListener('dragstart', handleNativeDragStart)
      node.removeEventListener('mousedown', handleMouseDown)

      if (activeDrag?.sourceNode === node) {
        finishDrag()
      }
    }
  }
}

export const droppable = (node: HTMLElement, options: DroppableOptions) => {
  let droppableOptions = options
  const registration: DroppableRegistration = {
    node,
    getOptions: () => droppableOptions
  }

  droppableRegistrations.add(registration)
  droppableRegistrationByNode.set(node, registration)
  if (activeDrag) {
    updateActiveDropTarget()
  }
  setDroppableState(
    activeDropTarget?.registration === registration ? activeDropTarget : null,
    activeDropTarget?.registration === registration
  )

  return {
    update(nextOptions: DroppableOptions) {
      const previousState = droppableOptions.state
      droppableOptions = nextOptions
      if (activeDrag) {
        updateActiveDropTarget()
      }

      // Side effect: keep opt-in row hover state aligned when options swap state objects.
      if (previousState && previousState !== droppableOptions.state) {
        previousState.isOver = false
        previousState.edge = null
      }
      setDroppableState(
        activeDropTarget?.registration === registration ? activeDropTarget : null,
        activeDropTarget?.registration === registration
      )
    },
    destroy() {
      setDroppableState(
        activeDropTarget?.registration === registration ? activeDropTarget : null,
        false
      )
      droppableRegistrations.delete(registration)
      droppableRegistrationByNode.delete(node)
      if (activeDropTarget?.registration === registration) {
        updateActiveDropTarget()
      }
    }
  }
}

export const dragDropOverlayState = {
  get isVisible() {
    return activeDrag !== null
  },
  get previewSnippet() {
    return activeDrag?.previewSnippet ?? null
  },
  get leftPx() {
    return cursorX + OVERLAY_OFFSET_X_PX
  },
  get topPx() {
    return cursorY
  }
}
