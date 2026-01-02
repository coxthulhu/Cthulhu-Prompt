import { isDevOrPlaywrightEnvironment } from '@renderer/app/runtimeConfig'
import { setMonacoHydrationQueuePaused } from '@renderer/features/prompt-editor/monacoHydrationQueue'

let monacoHydrationPaused = false
export const isMonacoHydrationPaused = (): boolean => monacoHydrationPaused

export const setMonacoHydrationPaused = (next: boolean): void => {
  if (monacoHydrationPaused === next) return
  monacoHydrationPaused = next
  setMonacoHydrationQueuePaused(next)
}

export const pauseMonacoHydration = (): void => {
  setMonacoHydrationPaused(true)
}

export const resumeMonacoHydration = (): void => {
  setMonacoHydrationPaused(false)
}

let controlsInitialized = false

export const initializeSvelteVirtualWindowHydrationControls = (): void => {
  if (controlsInitialized || !isDevOrPlaywrightEnvironment()) return
  controlsInitialized = true

  window.svelteVirtualWindowTestControls = {
    pauseMonacoHydration: () => pauseMonacoHydration(),
    resumeMonacoHydration: () => resumeMonacoHydration(),
    setMonacoHydrationPaused: (next: boolean) => setMonacoHydrationPaused(next)
  }
}
