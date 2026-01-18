export type MonacoHydrationEntry = {
  priority: number
  activate: () => void
}

const activationQueue: MonacoHydrationEntry[] = []
let rafHandle: number | null = null
let hydrationPaused = false

export const isMonacoHydrationQueuePaused = (): boolean => hydrationPaused

const scheduleActivation = (): void => {
  if (hydrationPaused || rafHandle != null) return
  rafHandle = window.requestAnimationFrame(() => {
    rafHandle = null
    if (hydrationPaused) return
    if (activationQueue.length === 0) return
    activationQueue.sort((left, right) => left.priority - right.priority)
    const selected = activationQueue.shift()!
    selected.activate()

    if (activationQueue.length > 0) {
      scheduleActivation()
    }
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
