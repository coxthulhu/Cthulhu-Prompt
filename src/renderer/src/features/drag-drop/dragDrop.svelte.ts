import { SvelteMap } from 'svelte/reactivity'
import type { Component } from 'svelte'

const DRAG_START_DISTANCE_PX = 4
const DRAG_GHOST_OFFSET_PX = 4
const DRAG_GHOST_OPACITY = '1'

export type DroppableEdge = 'top' | 'bottom'
export type DroppableAllowedEdges = 'none' | 'top' | 'bottom' | 'top-and-bottom'
type DroppablePayloadResolver<TDropPayload> = (edge: DroppableEdge | null) => TDropPayload

export type DragFinishResult<TSourcePayload, TDropPayload> = {
  sourcePayload: TSourcePayload
  dropPayload: TDropPayload | null
}

export type DragGhostOptions = {
  component: Component<any>
  kind?: string
  props?: Record<string, unknown>
}

export type DragGhostFactory<TSourcePayload> = (
  payload: TSourcePayload,
  sourceNode: HTMLElement
) => DragGhostOptions | null

export type DraggableOptions<TSourcePayload = unknown, TDropPayload = unknown> = {
  dragType: string
  payload: TSourcePayload
  createGhost?: DragGhostFactory<TSourcePayload>
  onDragStart?: (payload: TSourcePayload) => void
  onDragFinish?: (result: DragFinishResult<TSourcePayload, TDropPayload>) => void
}

export type DroppableOptions<TDraggedPayload = unknown, TDropPayload = unknown> = {
  dragType: string
  payload?: TDropPayload | DroppablePayloadResolver<TDropPayload>
  allowedEdges?: DroppableAllowedEdges
  canDrop?: (payload: TDraggedPayload, edge: DroppableEdge | null) => boolean
  onDrop?: (payload: TDraggedPayload) => void
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
  onDragStart: (() => void) | null
  onDragFinish: ((dropPayload: unknown | null) => void) | null
  cursorStyleElement: HTMLStyleElement | null
}

export type ActiveDragGhost = DragGhostOptions & {
  opacity: string
  x: number
  y: number
}

type NormalizedDroppableOptions = {
  dragType: string
  allowedEdges: DroppableAllowedEdges
  canDrop: (payload: unknown, edge: DroppableEdge | null) => boolean
  resolvePayload: (edge: DroppableEdge | null) => unknown | null
  onDrop: ((payload: unknown) => void) | null
  state?: DroppableState
}

type DroppableRegistration = {
  node: HTMLElement
  getOptions: () => NormalizedDroppableOptions
}

type ActiveDropTarget = {
  registration: DroppableRegistration
  edge: DroppableEdge | null
}

let activeDrag = $state<ActiveDrag | null>(null)
let cursorX = $state(0)
let cursorY = $state(0)
let activeDragGhost = $state<ActiveDragGhost | null>(null)
let activeDropTarget: ActiveDropTarget | null = null
const droppableRegistrationByNode = new WeakMap<HTMLElement, DroppableRegistration>()

export const dragDropOverlayState = {
  get activeDragGhost() {
    return activeDragGhost
  }
}

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

const normalizeDroppableOptions = <TDraggedPayload, TDropPayload>(
  options: DroppableOptions<TDraggedPayload, TDropPayload>
): NormalizedDroppableOptions => {
  const payload = options.payload
  const canDrop = options.canDrop

  return {
    dragType: options.dragType,
    allowedEdges: options.allowedEdges ?? 'none',
    canDrop: canDrop
      ? (draggedPayload, edge) => canDrop(draggedPayload as TDraggedPayload, edge)
      : () => true,
    resolvePayload:
      typeof payload === 'function'
        ? (edge) => (payload as DroppablePayloadResolver<TDropPayload>)(edge) ?? null
        : () => payload ?? null,
    onDrop: options.onDrop
      ? (draggedPayload) => options.onDrop?.(draggedPayload as TDraggedPayload)
      : null,
    state: options.state
  }
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

const resolveDropEdge = (
  node: HTMLElement,
  allowedEdges: DroppableAllowedEdges,
  cursorY: number
): DroppableEdge | null => {
  if (allowedEdges === 'none') {
    return null
  }

  if (allowedEdges === 'top' || allowedEdges === 'bottom') {
    return allowedEdges
  }

  const { top, height } = node.getBoundingClientRect()
  return cursorY < top + height / 2 ? 'top' : 'bottom'
}

const getDropTargetFromPoint = (
  x: number,
  y: number,
  dragType: string,
  draggedPayload: unknown
): ActiveDropTarget | null => {
  for (const element of document.elementsFromPoint(x, y)) {
    const registration = getClosestRegisteredDroppable(
      element instanceof Element ? element : null,
      dragType
    )
    if (registration) {
      const options = registration.getOptions()
      const edge = resolveDropEdge(registration.node, options.allowedEdges, y)
      if (!options.canDrop(draggedPayload, edge)) {
        continue
      }

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

  const matchedDropTarget = getDropTargetFromPoint(
    cursorX,
    cursorY,
    activeDrag.dragType,
    activeDrag.payload
  )

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
  if (activeDragGhost) {
    activeDragGhost = {
      ...activeDragGhost,
      x: nextX + DRAG_GHOST_OFFSET_PX,
      y: nextY + DRAG_GHOST_OFFSET_PX
    }
  }
  updateActiveDropTarget()
}

const showDragGhost = <TSourcePayload, TDropPayload>(
  sourceNode: HTMLElement,
  options: DraggableOptions<TSourcePayload, TDropPayload>,
  sourcePayload: TSourcePayload
): void => {
  const ghost = options.createGhost?.(sourcePayload, sourceNode) ?? null
  if (!ghost) {
    activeDragGhost = null
    return
  }

  activeDragGhost = {
    ...ghost,
    opacity: DRAG_GHOST_OPACITY,
    x: cursorX + DRAG_GHOST_OFFSET_PX,
    y: cursorY + DRAG_GHOST_OFFSET_PX
  }
}

const beginDrag = <TSourcePayload, TDropPayload>(
  sourceNode: HTMLElement,
  options: DraggableOptions<TSourcePayload, TDropPayload>,
  startX: number,
  startY: number
): void => {
  const sourcePayload = options.payload
  activeDrag = {
    sourceNode,
    dragType: options.dragType,
    payload: sourcePayload,
    onDragStart: options.onDragStart ? () => options.onDragStart?.(sourcePayload) : null,
    onDragFinish: options.onDragFinish
      ? (dropPayload) =>
          options.onDragFinish?.({
            sourcePayload,
            dropPayload: dropPayload as TDropPayload | null
          })
      : null,
    cursorStyleElement: createDragCursorStyleElement(sourceNode)
  }

  showDragGhost(sourceNode, options, sourcePayload)
  activeDrag.onDragStart?.()
  updateDragCursor(startX, startY)
  document.body.style.userSelect = 'none'
}

const finishDrag = (): {
  activeDrag: ActiveDrag | null
  activeDropTarget: ActiveDropTarget | null
} => {
  const currentActiveDrag = activeDrag
  const currentActiveDropTarget = activeDropTarget

  activeDragGhost = null
  clearActiveDrag()
  restoreDocumentDragState()
  currentActiveDrag?.cursorStyleElement?.remove()

  return {
    activeDrag: currentActiveDrag,
    activeDropTarget: currentActiveDropTarget
  }
}

const endDrag = (): void => {
  const { activeDrag: completedDrag, activeDropTarget: completedDropTarget } = finishDrag()

  if (!completedDrag) {
    return
  }

  const dropPayload =
    completedDropTarget?.registration.getOptions().resolvePayload(completedDropTarget.edge) ?? null
  completedDropTarget?.registration.getOptions().onDrop?.(completedDrag.payload)
  completedDrag.onDragFinish?.(dropPayload)
}

export const draggable = <TSourcePayload = unknown, TDropPayload = unknown>(
  node: HTMLElement,
  options: DraggableOptions<TSourcePayload, TDropPayload>
) => {
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
    update(nextOptions: DraggableOptions<TSourcePayload, TDropPayload>) {
      draggableOptions = nextOptions
    },
    destroy() {
      node.removeEventListener('dragstart', handleNativeDragStart)
      node.removeEventListener('mousedown', handleMouseDown)
      // Keep the active drag alive if virtualization unmounts the source row mid-drag.
    }
  }
}

export const droppable = <TDraggedPayload = unknown, TDropPayload = unknown>(
  node: HTMLElement,
  options: DroppableOptions<TDraggedPayload, TDropPayload>
) => {
  let droppableOptions = normalizeDroppableOptions(options)
  const registration: DroppableRegistration = {
    node,
    getOptions: () => droppableOptions
  }

  droppableRegistrationByNode.set(node, registration)
  if (activeDrag) {
    updateActiveDropTarget()
  }
  setDroppableState(
    activeDropTarget?.registration === registration ? activeDropTarget : null,
    activeDropTarget?.registration === registration
  )

  return {
    update(nextOptions: DroppableOptions<TDraggedPayload, TDropPayload>) {
      const previousState = droppableOptions.state
      droppableOptions = normalizeDroppableOptions(nextOptions)
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
      droppableRegistrationByNode.delete(node)
      if (activeDropTarget?.registration === registration) {
        updateActiveDropTarget()
      }
    }
  }
}
