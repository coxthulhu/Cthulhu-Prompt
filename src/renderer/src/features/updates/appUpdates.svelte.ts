import { tick } from 'svelte'
import type { AppUpdateState } from '@shared/runtime/AppUpdates'
import { popupActivity } from '@renderer/common/cthulhu-ui/dialogs/popupActivity.svelte'

/** Connects the shell's notification readiness and existing save preparation to the updater. */
export const createAppUpdates = (canNotify: () => boolean, prepareRestart: () => Promise<void>) => {
  /** Renderer presentation state follows main while popup visibility remains local. */
  const updates = $state<{ snapshot: AppUpdateState | null; open: boolean }>({ snapshot: null, open: false })
  /** Immediate dismissal blocks reopen while its IPC acknowledgement is in flight. */
  let dismissed = $state(false)

  /** Requires successful discovery and an unobstructed application before notifying. */
  const shouldNotify = (): boolean => !!updates.snapshot &&
    updates.snapshot.mode !== 'development' && updates.snapshot.status === 'available' &&
    !updates.snapshot.notificationDismissed && !dismissed && !updates.open &&
    canNotify() && popupActivity.modalCount === 0

  // Side effect: subscribe before loading the snapshot so startup events cannot be missed.
  $effect(() => {
    /** An event received during the initial query takes precedence over its older snapshot. */
    let receivedEvent = false
    /** Ignore the outstanding initial query if the shell has unmounted. */
    let active = true
    /** Removes only this component's listener on unmount. */
    const unsubscribe = window.appUpdates.onChange((state) => {
      receivedEvent = true
      updates.snapshot = state
    })
    void window.appUpdates.getState().then((state) => {
      if (active && !receivedEvent) updates.snapshot = state
    })
    return () => { active = false; unsubscribe() }
  })

  // Side effect: let newly opened dialogs mount before making the final auto-open decision.
  $effect(() => {
    if (!shouldNotify()) return
    void tick().then(() => { if (shouldNotify()) updates.open = true })
  })

  // Side effect: flush saves after rendering the final state, then begin the one-second countdown.
  $effect(() => {
    if (updates.snapshot?.status !== 'restarting') return
    void (async () => {
      await tick()
      try { await prepareRestart() } catch (error) { console.error('Update save flush failed:', error) }
      await window.appUpdates.restart()
    })()
  })

  return {
    updates,
    /** Dismissing any popup showing an available update silences notifications for this session. */
    dismiss: (): void => {
      if (!updates.snapshot?.hasUpdate || updates.snapshot.status === 'checking' ||
        updates.snapshot.status === 'check-error') return
      dismissed = true
      void window.appUpdates.dismiss()
    },
    /** Locks controls immediately while main starts the asynchronous download. */
    start: (): void => {
      if (updates.snapshot) updates.snapshot.status = 'downloading'
      void window.appUpdates.start()
    }
  }
}
