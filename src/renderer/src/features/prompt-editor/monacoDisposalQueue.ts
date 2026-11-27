/** Releases of unmounted editors, run once the renderer is idle instead of during the navigation that unmounted them. */
const pendingDisposals: Array<() => void> = []
/** Idle callback that runs the pending releases, or null when none is scheduled. */
let idleHandle: number | null = null

/** Runs releases while the idle period lasts and reschedules any that remain. */
const runPendingDisposals = (deadline: IdleDeadline): void => {
  idleHandle = null
  while (pendingDisposals.length > 0 && (deadline.didTimeout || deadline.timeRemaining() > 0)) {
    pendingDisposals.shift()!()
  }
  if (pendingDisposals.length > 0) scheduleDisposals()
}

const scheduleDisposals = (): void => {
  idleHandle ??= window.requestIdleCallback(runPendingDisposals, { timeout: 1000 })
}

/** Defers disposing an editor whose DOM has already left the page. */
export const disposeMonacoWhenIdle = (dispose: () => void): void => {
  pendingDisposals.push(dispose)
  scheduleDisposals()
}

/** Runs every deferred release now, before the models they reference are cleared. */
export const flushMonacoDisposals = (): void => {
  if (idleHandle != null) {
    window.cancelIdleCallback(idleHandle)
    idleHandle = null
  }
  while (pendingDisposals.length > 0) pendingDisposals.shift()!()
}
