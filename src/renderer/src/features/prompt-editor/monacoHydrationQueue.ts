export type MonacoHydrationEntry = {
  priority: number
  activate: () => void
}

const activationQueue: MonacoHydrationEntry[] = []
let rafHandle: number | null = null
let hydrationPaused = false
/** Whether the previous frame activated an editor; a queue starting from idle skips one frame first. */
let activatedLastFrame = false

export const isMonacoHydrationQueuePaused = (): boolean => hydrationPaused

const scheduleActivation = (): void => {
  if (hydrationPaused || rafHandle != null) return
  rafHandle = window.requestAnimationFrame(() => {
    rafHandle = null
    if (hydrationPaused) return
    if (activationQueue.length === 0) {
      activatedLastFrame = false
      return
    }
    if (!activatedLastFrame) {
      // Rows enqueued since the last frame mounted with this frame, so let it paint their placeholders first.
      activatedLastFrame = true
      scheduleActivation()
      return
    }
    activationQueue.sort((left, right) => left.priority - right.priority)
    const selected = activationQueue.shift()!
    selected.activate()
    // The next frame continues the queue, or ends this run of activations once it is empty.
    scheduleActivation()
  })
}

export const setMonacoHydrationQueuePaused = (paused: boolean): void => {
  if (hydrationPaused === paused) return
  hydrationPaused = paused
  if (paused) {
    if (rafHandle != null) {
      window.cancelAnimationFrame(rafHandle)
      rafHandle = null
    }
    return
  }
  if (activationQueue.length > 0) {
    scheduleActivation()
  }
}

export const pauseMonacoHydrationForFrame = (): (() => void) => {
  const wasPaused = hydrationPaused
  setMonacoHydrationQueuePaused(true)
  let resumed = false
  return () => {
    if (resumed) return
    resumed = true
    setMonacoHydrationQueuePaused(wasPaused)
  }
}

export const enqueueMonacoHydration = (
  priority: number,
  activate: () => void
): MonacoHydrationEntry => {
  const entry: MonacoHydrationEntry = {
    priority,
    activate
  }

  activationQueue.push(entry)
  scheduleActivation()
  return entry
}

export const cancelMonacoHydration = (entry: MonacoHydrationEntry): void => {
  activationQueue.splice(activationQueue.indexOf(entry), 1)
}

export const updateMonacoHydrationPriority = (
  entry: MonacoHydrationEntry,
  priority: number
): void => {
  entry.priority = priority
  scheduleActivation()
}
