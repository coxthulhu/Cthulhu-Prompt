import { isDevOrPlaywrightEnvironment } from '@renderer/app/runtimeConfig'
import { tick } from 'svelte'
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
type VirtualWindowScrollApi = {
  scrollTo: (scrollTopPx: number) => void
  getScrollTop: () => number
  getScrollHeight: () => number
}
const virtualWindowScrollApis = new Map<string, VirtualWindowScrollApi>()

export const initializeSvelteVirtualWindowHydrationControls = (): void => {
  if (controlsInitialized || !isDevOrPlaywrightEnvironment()) return
  controlsInitialized = true

  window.svelteVirtualWindowTestControls = {
    pauseMonacoHydration: () => pauseMonacoHydration(),
    resumeMonacoHydration: () => resumeMonacoHydration(),
    setMonacoHydrationPaused: (next: boolean) => setMonacoHydrationPaused(next),
    registerVirtualWindowScroller: (testId, api) => {
      virtualWindowScrollApis.set(testId, api)
    },
    unregisterVirtualWindowScroller: (testId) => {
      virtualWindowScrollApis.delete(testId)
    },
    scrollTo: async (testId, scrollTopPx) => {
      virtualWindowScrollApis.get(testId)?.scrollTo(scrollTopPx)
      // Commit the requested viewport placement before test helpers measure its rows.
      await tick()
    },
    getScrollTop: (testId) => {
      return virtualWindowScrollApis.get(testId)?.getScrollTop() ?? null
    },
    getScrollHeight: (testId) => {
      return virtualWindowScrollApis.get(testId)?.getScrollHeight() ?? null
    }
  }
}
