import type { Snippet } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

const DRAG_START_DISTANCE_PX = 4
const OVERLAY_OFFSET_X_PX = 12

export type DragDropPreview = Snippet<[]>

export type DraggableOptions = {
  type: string
  data: unknown
  preview: DragDropPreview
}

export type DroppableOptions = {
  type: string
  onDrop: (data: unknown) => void
}

type ActiveDrag = {
  sourceNode: HTMLElement
  type: string
  data: unknown
  preview: DragDropPreview
}

type DroppableRegistration = {
  node: HTMLElement
  getOptions: () => DroppableOptions
}

let activeDrag = $state<ActiveDrag | null>(null)
let cursorX = $state(0)
let cursorY = $state(0)
let activeDropTarget = $state<DroppableRegistration | null>(null)
const droppables = new SvelteMap<symbol, DroppableRegistration>()

const pointIsInsideRect = (rect: DOMRect, x: number, y: number): boolean => {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

const squaredCenterDistance = (rect: DOMRect, x: number, y: number): number => {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const deltaX = centerX - x
  const deltaY = centerY - y
  return deltaX * deltaX + deltaY * deltaY
}

const updateActiveDropTarget = (): void => {
  if (!activeDrag) {
    activeDropTarget = null
    return
  }

  let closestMatch: DroppableRegistration | null = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (const candidate of droppables.values()) {
    const options = candidate.getOptions()
    if (options.type !== activeDrag.type) {
      continue
    }

    const rect = candidate.node.getBoundingClientRect()
    if (!pointIsInsideRect(rect, cursorX, cursorY)) {
      continue
    }

    const distance = squaredCenterDistance(rect, cursorX, cursorY)
    if (distance < closestDistance) {
      closestMatch = candidate
      closestDistance = distance
    }
  }

  activeDropTarget = closestMatch
}

const clearActiveDrag = (): void => {
  activeDrag = null
  activeDropTarget = null
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
    type: options.type,
    data: options.data,
    preview: options.preview
  }

  updateDragCursor(startX, startY)
  document.body.style.userSelect = 'none'
}

const endDrag = (): void => {
  const currentDrag = activeDrag
  const dropTarget = activeDropTarget

  clearActiveDrag()
  document.body.style.userSelect = ''

  if (!currentDrag || !dropTarget) {
    return
  }

  dropTarget.getOptions().onDrop(currentDrag.data)
}

const cancelDrag = (): void => {
  clearActiveDrag()
  document.body.style.userSelect = ''
}

export const draggable = (node: HTMLElement, options: DraggableOptions) => {
  let currentOptions = options

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

        beginDrag(node, currentOptions, moveEvent.clientX, moveEvent.clientY)
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
      currentOptions = nextOptions
    },
    destroy() {
      node.removeEventListener('dragstart', handleNativeDragStart)
      node.removeEventListener('mousedown', handleMouseDown)

      if (activeDrag?.sourceNode === node) {
        cancelDrag()
      }
    }
  }
}

export const droppable = (node: HTMLElement, options: DroppableOptions) => {
  let currentOptions = options
  const registrationId = Symbol('droppable')
  const registration: DroppableRegistration = {
    node,
    getOptions: () => currentOptions
  }

  droppables.set(registrationId, registration)

  return {
    update(nextOptions: DroppableOptions) {
      currentOptions = nextOptions
      if (activeDrag) {
        updateActiveDropTarget()
      }
    },
    destroy() {
      droppables.delete(registrationId)
      if (activeDropTarget === registration) {
        updateActiveDropTarget()
      }
    }
  }
}

export const dragDropOverlayState = {
  get isVisible() {
    return activeDrag !== null
  },
  get preview() {
    return activeDrag?.preview ?? null
  },
  get leftPx() {
    return cursorX + OVERLAY_OFFSET_X_PX
  },
  get topPx() {
    return cursorY
  }
}
