/** Callbacks and capture owner for one pointer press. */
type PointerDragOptions = {
  target: HTMLElement
  event: PointerEvent
  onMove: (event: PointerEvent) => void
  onFinish: (cancelled: boolean) => void
  captureImmediately?: boolean
}

/** Tracks one pointer and releases all session resources before reporting its completion. */
export const startPointerDrag = ({
  target,
  event,
  onMove,
  onFinish,
  captureImmediately = true
}: PointerDragOptions) => {
  /** Pointer identity retained even after its source row is virtualized away. */
  const pointerId = event.pointerId
  /** Prevents release-triggered capture loss from completing the session twice. */
  let finished = false

  /** Ends the session before callbacks can unmount or reorder its capture owner. */
  const finish = (cancelled: boolean): void => {
    if (finished) return
    finished = true
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', handleCancel)
    target.removeEventListener('lostpointercapture', handleCancel)
    removalObserver.disconnect()
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
    onFinish(cancelled)
  }
  /** Ignores movement from other fingers or devices during this press. */
  const handleMove = (nextEvent: PointerEvent): void => {
    if (nextEvent.pointerId === pointerId) onMove(nextEvent)
  }
  /** Completes only the pointer that started this drag. */
  const handleUp = (nextEvent: PointerEvent): void => {
    if (nextEvent.pointerId === pointerId) finish(false)
  }
  /** Cancels browser-interrupted drags without accepting their current drop target. */
  const handleCancel = (nextEvent: PointerEvent): void => {
    // Touch capture transferred from a child row also bubbles through the owning frame.
    if (nextEvent.type === 'lostpointercapture' && nextEvent.target !== target) return
    if (nextEvent.pointerId === pointerId) finish(true)
  }
  /** Captures immediately for sashes, or after the movement threshold for clickable rows. */
  const capture = (): void => target.setPointerCapture(pointerId)
  /** Cancels when the owning viewport or control disappears, while allowing row virtualization. */
  const removalObserver = new MutationObserver(() => {
    if (!target.isConnected) finish(true)
  })
  removalObserver.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('pointermove', handleMove, { passive: false })
  window.addEventListener('pointerup', handleUp)
  window.addEventListener('pointercancel', handleCancel)
  target.addEventListener('lostpointercapture', handleCancel)
  if (captureImmediately) capture()

  return { capture, cancel: () => finish(true) }
}
