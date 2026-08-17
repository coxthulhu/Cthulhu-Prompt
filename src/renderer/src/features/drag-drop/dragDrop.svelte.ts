import { SvelteMap, SvelteSet } from 'svelte/reactivity'
import type { Component } from 'svelte'

const DRAG_START_DISTANCE_PX = 4
const DRAG_GHOST_OFFSET_PX = 4
const DRAG_GHOST_OPACITY = '1'
const DROPDOWN_KEEP_OPEN_INSET_PX = 16
/** Default symmetric snap expansion applied to every drop target. */
export const DEFAULT_DROPPABLE_SNAP_DIMENSIONS = { x: 0, y: 100 } as const

export type DroppableEdge = 'top' | 'bottom'
export type DroppableAllowedEdges = 'none' | 'top' | 'bottom' | 'top-and-bottom'
/** Symmetric target expansion used to make a drop target snappable. */
export type DroppableSnapDimensions = {
  x?: number
  y?: number
}
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
  onDragMove?: (payload: TSourcePayload, clientX: number, clientY: number) => void
  onDragFinish?: (result: DragFinishResult<TSourcePayload, TDropPayload>) => void
}

export type DroppableOptions<TDraggedPayload = unknown, TDropPayload = unknown> = {
  dragType: string
  payload?: TDropPayload | DroppablePayloadResolver<TDropPayload>
  allowedEdges?: DroppableAllowedEdges
  snapDimensions?: DroppableSnapDimensions
  canDrop?: (payload: TDraggedPayload, edge: DroppableEdge | null) => boolean
  onDrop?: (payload: TDraggedPayload) => void
  indicator: DroppableState
}

/** Local indicator state controlled exclusively by the drag/drop resolver. */
export type DroppableState = {
  isOver: boolean
  isBlocked: boolean
  edge: DroppableEdge | null
}

export type DroppableStateRegistry<TKey extends string = string> = {
  getState: (key: TKey) => DroppableState
  isOver: (key: TKey) => boolean
  isBlocked: (key: TKey) => boolean
  edge: (key: TKey) => DroppableEdge | null
}

type ActiveDrag = {
  sourceNode: HTMLElement
  dragType: string
  payload: unknown
  onDragStart: (() => void) | null
  onDragMove: ((clientX: number, clientY: number) => void) | null
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
  snapDimensions: Required<DroppableSnapDimensions>
  canDrop: (payload: unknown, edge: DroppableEdge | null) => boolean
  resolvePayload: (edge: DroppableEdge | null) => unknown | null
  onDrop: ((payload: unknown) => void) | null
  indicator: DroppableState
}

type DroppableRegistration = {
  node: HTMLElement
  getOptions: () => NormalizedDroppableOptions
}

type ActiveDropTarget = {
  registration: DroppableRegistration
  edge: DroppableEdge | null
  isBlocked: boolean
}

type SnapCandidate = {
  registration: DroppableRegistration
  edge: DroppableEdge | null
  distance: number
}

/** Minimal geometry shared by candidates participating in nearest-target selection. */
export type DroppableDistanceCandidate = {
  distance: number
}

type VirtualDropGeometry = {
  nodeRect: DOMRect
  viewportRect: DOMRect | null
  visibleRect: DOMRect
}

type DragDropDropdownRegistration = {
  triggerNode: HTMLElement
  getMenuNode: () => HTMLElement | null
  getDragOpenTypes: () => readonly string[]
  isOpen: () => boolean
  openForDrag: () => void
  closeDragOpened: () => void
}

// Imperative session state must not inherit stale values from outgoing Svelte effect branches.
let activeDrag: ActiveDrag | null = null
let cursorX = $state(0)
let cursorY = $state(0)
let activeDragGhost = $state<ActiveDragGhost | null>(null)
let activeDropTarget: ActiveDropTarget | null = null
const droppableRegistrations = new SvelteSet<DroppableRegistration>()
const dragDropDropdownRegistrations = new SvelteSet<DragDropDropdownRegistration>()

export const dragDropOverlayState = {
  get activeDragGhost() {
    return activeDragGhost
  }
}

export const createDroppableStateRegistry = <
  TKey extends string
>(): DroppableStateRegistry<TKey> => {
  // This identity cache is intentionally nonreactive so render-time lookups can create entries.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const stateByKey = new Map<TKey, DroppableState>()
  const isOverByKey = new SvelteMap<TKey, boolean>()
  /** Blocked status keyed separately so indicator state stays rune-reactive. */
  const isBlockedByKey = new SvelteMap<TKey, boolean>()
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
      get isBlocked() {
        return isBlockedByKey.get(key) ?? false
      },
      set isBlocked(value: boolean) {
        if (value) {
          isBlockedByKey.set(key, true)
          return
        }

        isBlockedByKey.delete(key)
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
    isBlocked: (key: TKey) => isBlockedByKey.get(key) ?? false,
    edge: (key: TKey) => edgeByKey.get(key) ?? null
  }
}

const setDroppableState = (dropTarget: ActiveDropTarget | null, isOver: boolean): void => {
  const dropState = dropTarget?.registration.getOptions().indicator
  if (!dropState) return

  dropTarget.registration.node.dataset.dropIndicatorActive = isOver ? 'true' : 'false'
  dropState.isOver = isOver
  dropState.isBlocked = isOver && dropTarget.isBlocked
  dropState.edge = isOver ? dropTarget.edge : null
}

/** Selects the nearest candidate while retaining iterable order for exact ties. */
export const selectNearestDroppableCandidate = <TCandidate extends DroppableDistanceCandidate>(
  candidates: Iterable<TCandidate>
): TCandidate | null => {
  /** Current winner, retained when a later candidate has equal distance. */
  let nearestCandidate: TCandidate | null = null

  for (const candidate of candidates) {
    if (!nearestCandidate || candidate.distance < nearestCandidate.distance) {
      nearestCandidate = candidate
    }
  }

  return nearestCandidate
}

const areSameActiveDropTarget = (
  left: ActiveDropTarget | null,
  right: ActiveDropTarget | null
): boolean => {
  return (
    left?.registration === right?.registration &&
    left?.edge === right?.edge &&
    left?.isBlocked === right?.isBlocked
  )
}

const setActiveDropTarget = (nextDropTarget: ActiveDropTarget | null): void => {
  const resolvedDropTarget = activeDrag ? nextDropTarget : null
  if (areSameActiveDropTarget(activeDropTarget, resolvedDropTarget)) {
    return
  }

  setDroppableState(activeDropTarget, false)
  activeDropTarget = resolvedDropTarget
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
    snapDimensions: {
      x: options.snapDimensions?.x ?? DEFAULT_DROPPABLE_SNAP_DIMENSIONS.x,
      y: options.snapDimensions?.y ?? DEFAULT_DROPPABLE_SNAP_DIMENSIONS.y
    },
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
    indicator: options.indicator
  }
}

const distanceToSegment = (
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  const clampedX = Math.min(Math.max(x, Math.min(x1, x2)), Math.max(x1, x2))
  const clampedY = Math.min(Math.max(y, Math.min(y1, y2)), Math.max(y1, y2))
  return Math.hypot(x - clampedX, y - clampedY)
}

const distanceToRect = (x: number, y: number, rect: DOMRect): number => {
  const clampedX = Math.min(Math.max(x, rect.left), rect.right)
  const clampedY = Math.min(Math.max(y, rect.top), rect.bottom)
  return Math.hypot(x - clampedX, y - clampedY)
}

const isPointInInflatedRect = (x: number, y: number, rect: DOMRect, insetPx: number): boolean => {
  return (
    x >= rect.left - insetPx &&
    x <= rect.right + insetPx &&
    y >= rect.top - insetPx &&
    y <= rect.bottom + insetPx
  )
}

const getUnionRect = (firstRect: DOMRect, secondRect: DOMRect): DOMRect => {
  const left = Math.min(firstRect.left, secondRect.left)
  const top = Math.min(firstRect.top, secondRect.top)
  const right = Math.max(firstRect.right, secondRect.right)
  const bottom = Math.max(firstRect.bottom, secondRect.bottom)

  return DOMRect.fromRect({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  })
}

const getDropdownKeepOpenRect = (registration: DragDropDropdownRegistration): DOMRect => {
  const triggerRect = registration.triggerNode.getBoundingClientRect()
  const menuRect = registration.getMenuNode()?.getBoundingClientRect()

  return menuRect ? getUnionRect(triggerRect, menuRect) : triggerRect
}

const isCursorNearDropdown = (registration: DragDropDropdownRegistration): boolean => {
  return isPointInInflatedRect(
    cursorX,
    cursorY,
    getDropdownKeepOpenRect(registration),
    DROPDOWN_KEEP_OPEN_INSET_PX
  )
}

const canDragOpenDropdown = (
  registration: DragDropDropdownRegistration,
  dragType: string
): boolean => {
  return registration.getDragOpenTypes().includes(dragType)
}

const findHoveredDragOpenDropdown = (dragType: string): DragDropDropdownRegistration | null => {
  for (const element of document.elementsFromPoint(cursorX, cursorY)) {
    for (const registration of dragDropDropdownRegistrations) {
      if (
        canDragOpenDropdown(registration, dragType) &&
        element instanceof Node &&
        registration.triggerNode.contains(element)
      ) {
        return registration
      }
    }
  }

  return null
}

const getTopmostOpenDropdownLayer = (): DragDropDropdownRegistration | null => {
  let topmostRegistration: DragDropDropdownRegistration | null = null
  let topmostNode: HTMLElement | null = null

  for (const registration of dragDropDropdownRegistrations) {
    if (!registration.isOpen()) {
      continue
    }

    const node = registration.getMenuNode()
    if (!topmostRegistration || !topmostNode || !node) {
      topmostRegistration = registration
      topmostNode = node
      continue
    }

    if (topmostNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) {
      topmostRegistration = registration
      topmostNode = node
    }
  }

  return topmostRegistration
}

const isDroppableInOpenDropdownLayer = (registration: DroppableRegistration): boolean => {
  const dropdownLayer = getTopmostOpenDropdownLayer()
  if (!dropdownLayer) {
    return true
  }

  const menuNode = dropdownLayer.getMenuNode()
  return menuNode ? menuNode.contains(registration.node) : false
}

const updateDragOpenDropdowns = (): void => {
  if (!activeDrag) {
    return
  }

  findHoveredDragOpenDropdown(activeDrag.dragType)?.openForDrag()

  for (const registration of dragDropDropdownRegistrations) {
    if (registration.isOpen() && !isCursorNearDropdown(registration)) {
      registration.closeDragOpened()
    }
  }
}

const closeDragOpenedDropdowns = (): void => {
  for (const registration of dragDropDropdownRegistrations) {
    registration.closeDragOpened()
  }
}

const getVirtualViewport = (node: HTMLElement): HTMLElement | null => {
  return node.closest('[data-virtual-window-viewport]')
}

const getDroppableEdgeY = (nodeRect: DOMRect, edge: DroppableEdge): number => {
  return edge === 'top' ? nodeRect.top : nodeRect.bottom
}

const isDroppableEdgeVisibleInViewport = (
  edge: DroppableEdge,
  nodeRect: DOMRect,
  viewportRect: DOMRect | null
): boolean => {
  if (!viewportRect) return true
  const edgeY = getDroppableEdgeY(nodeRect, edge)
  return edgeY >= viewportRect.top && edgeY <= viewportRect.bottom
}

/** Returns target geometry after clipping it to its virtual viewport. */
const getVirtualDropGeometry = (
  node: HTMLElement
): VirtualDropGeometry | null => {
  const nodeRect = node.getBoundingClientRect()
  const viewport = getVirtualViewport(node)
  if (!viewport) {
    return {
      nodeRect,
      viewportRect: null,
      visibleRect: nodeRect
    }
  }

  const viewportRect = viewport.getBoundingClientRect()
  const left = Math.max(nodeRect.left, viewportRect.left)
  const right = Math.min(nodeRect.right, viewportRect.right)
  const top = Math.max(nodeRect.top, viewportRect.top)
  const bottom = Math.min(nodeRect.bottom, viewportRect.bottom)

  if (right <= left || bottom <= top) {
    return null
  }

  return {
    nodeRect,
    viewportRect,
    visibleRect: DOMRect.fromRect({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    })
  }
}

/** Returns whether the pointer is inside one target's expanded snap zone. */
export const isPointInDroppableSnapZone = (
  x: number,
  y: number,
  visibleRect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  snapDimensions: Required<DroppableSnapDimensions>
): boolean => {
  return (
    x >= visibleRect.left - snapDimensions.x &&
    x <= visibleRect.right + snapDimensions.x &&
    y >= visibleRect.top - snapDimensions.y &&
    y <= visibleRect.bottom + snapDimensions.y
  )
}

/** Builds the eligible edge list for one registered target. */
const getDroppableEdges = (allowedEdges: DroppableAllowedEdges): (DroppableEdge | null)[] => {
  if (allowedEdges === 'top-and-bottom') return ['top', 'bottom']
  if (allowedEdges === 'top' || allowedEdges === 'bottom') return [allowedEdges]
  return [null]
}

/** Measures the pointer against one candidate's unexpanded target geometry. */
const getCandidateDistance = (
  x: number,
  y: number,
  edge: DroppableEdge | null,
  nodeRect: DOMRect,
  visibleRect: DOMRect
): number => {
  if (!edge) return distanceToRect(x, y, visibleRect)

  const edgeY = getDroppableEdgeY(nodeRect, edge)
  return distanceToSegment(x, y, visibleRect.left, edgeY, visibleRect.right, edgeY)
}

/** Builds snap candidates for one registration using its clipped geometry. */
const getSnapCandidatesForRegistration = (
  registration: DroppableRegistration,
  x: number,
  y: number
): SnapCandidate[] => {
  const options = registration.getOptions()
  const geometry = getVirtualDropGeometry(registration.node)
  if (!geometry) {
    return []
  }

  const { nodeRect, viewportRect, visibleRect } = geometry
  if (!isPointInDroppableSnapZone(x, y, visibleRect, options.snapDimensions)) {
    return []
  }

  return getDroppableEdges(options.allowedEdges)
    .filter((edge) => !edge || isDroppableEdgeVisibleInViewport(edge, nodeRect, viewportRect))
    .map((edge) => ({
      registration,
      edge,
      distance: getCandidateDistance(x, y, edge, nodeRect, visibleRect)
    }))
}

/** Resolves the nearest eligible target without preferring allowed drops. */
const getNearestDropTarget = (
  x: number,
  y: number,
  dragType: string,
  draggedPayload: unknown
): ActiveDropTarget | null => {
  /** Candidates retain target registration and edge declaration order. */
  const candidates: SnapCandidate[] = []

  for (const registration of droppableRegistrations) {
    const options = registration.getOptions()
    if (options.dragType !== dragType) {
      continue
    }

    if (!isDroppableInOpenDropdownLayer(registration)) {
      continue
    }

    for (const candidate of getSnapCandidatesForRegistration(registration, x, y)) {
      candidates.push(candidate)
    }
  }

  const nearestCandidate = selectNearestDroppableCandidate(candidates)
  if (!nearestCandidate) {
    return null
  }

  const options = nearestCandidate.registration.getOptions()

  return {
    registration: nearestCandidate.registration,
    edge: nearestCandidate.edge,
    isBlocked: !options.canDrop(draggedPayload, nearestCandidate.edge)
  }
}

const updateActiveDropTarget = (): void => {
  if (!activeDrag) {
    setActiveDropTarget(null)
    return
  }

  const matchedDropTarget = getNearestDropTarget(
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

const snapToDevicePixel = (value: number): number => {
  const devicePixelRatio = window.devicePixelRatio || 1
  return Math.round(value * devicePixelRatio) / devicePixelRatio
}

const updateDragCursor = (nextX: number, nextY: number): void => {
  cursorX = nextX
  cursorY = nextY
  if (activeDragGhost) {
    activeDragGhost = {
      ...activeDragGhost,
      x: snapToDevicePixel(nextX + DRAG_GHOST_OFFSET_PX),
      y: snapToDevicePixel(nextY + DRAG_GHOST_OFFSET_PX)
    }
  }
  updateDragOpenDropdowns()
  updateActiveDropTarget()
  activeDrag?.onDragMove?.(nextX, nextY)
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
    x: snapToDevicePixel(cursorX + DRAG_GHOST_OFFSET_PX),
    y: snapToDevicePixel(cursorY + DRAG_GHOST_OFFSET_PX)
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
    onDragMove: options.onDragMove
      ? (clientX, clientY) => options.onDragMove?.(sourcePayload, clientX, clientY)
      : null,
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
    completedDropTarget && !completedDropTarget.isBlocked
      ? completedDropTarget.registration.getOptions().resolvePayload(completedDropTarget.edge)
      : null
  if (completedDropTarget && !completedDropTarget.isBlocked) {
    completedDropTarget.registration.getOptions().onDrop?.(completedDrag.payload)
  }
  completedDrag.onDragFinish?.(dropPayload)
  closeDragOpenedDropdowns()
}

export const registerDragDropDropdown = (
  registration: DragDropDropdownRegistration
): (() => void) => {
  dragDropDropdownRegistrations.add(registration)

  return () => {
    registration.closeDragOpened()
    dragDropDropdownRegistrations.delete(registration)
    if (activeDrag) {
      updateActiveDropTarget()
    }
  }
}

export const draggable = <TSourcePayload = unknown, TDropPayload = unknown>(
  node: HTMLElement,
  options: DraggableOptions<TSourcePayload, TDropPayload>
) => {
  let draggableOptions = options
  let suppressNextClick = false
  let suppressClickResetId: number | null = null

  const handleNativeDragStart = (event: DragEvent) => {
    event.preventDefault()
  }

  const clearClickSuppression = () => {
    suppressNextClick = false

    if (suppressClickResetId !== null) {
      window.clearTimeout(suppressClickResetId)
      suppressClickResetId = null
    }
  }

  const suppressClickAfterDrag = () => {
    clearClickSuppression()
    suppressNextClick = true
    suppressClickResetId = window.setTimeout(() => {
      clearClickSuppression()
    }, 0)
  }

  const handleClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) {
      return
    }

    clearClickSuppression()
    event.preventDefault()
    event.stopImmediatePropagation()
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
        suppressClickAfterDrag()
        endDrag()
      }
    }

    // Side effect: track the pointer on the window only for the active press.
    window.addEventListener('mousemove', handleMouseMove, { passive: false })
    window.addEventListener('mouseup', handleMouseUp)
  }

  node.draggable = false
  node.addEventListener('click', handleClickCapture, true)
  node.addEventListener('dragstart', handleNativeDragStart)
  node.addEventListener('mousedown', handleMouseDown)

  return {
    update(nextOptions: DraggableOptions<TSourcePayload, TDropPayload>) {
      draggableOptions = nextOptions
    },
    destroy() {
      clearClickSuppression()
      node.removeEventListener('click', handleClickCapture, true)
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

  droppableRegistrations.add(registration)
  if (activeDrag) {
    updateActiveDropTarget()
  }
  setDroppableState(
    activeDropTarget?.registration === registration ? activeDropTarget : null,
    activeDropTarget?.registration === registration
  )

  return {
    update(nextOptions: DroppableOptions<TDraggedPayload, TDropPayload>) {
      const previousState = droppableOptions.indicator
      droppableOptions = normalizeDroppableOptions(nextOptions)
      if (activeDrag) {
        updateActiveDropTarget()
      }

      // Side effect: keep opt-in row hover state aligned when options swap state objects.
      if (previousState !== droppableOptions.indicator) {
        previousState.isOver = false
        previousState.isBlocked = false
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
      if (activeDropTarget?.registration === registration) {
        updateActiveDropTarget()
      }
    }
  }
}
