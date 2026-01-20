/// <reference types="svelte" />
/// <reference types="vite/client" />

declare global {
  interface Window {
    svelteVirtualWindowTestControls?: {
      pauseMonacoHydration: () => void
      resumeMonacoHydration: () => void
      setMonacoHydrationPaused: (next: boolean) => void
      registerVirtualWindowScroller?: (
        testId: string,
        api: {
          scrollTo: (scrollTopPx: number) => void
          getScrollTop: () => number
          getScrollHeight: () => number
        }
      ) => void
      unregisterVirtualWindowScroller?: (testId: string) => void
      scrollTo?: (testId: string, scrollTopPx: number) => void
      getScrollTop?: (testId: string) => number | null
      getScrollHeight?: (testId: string) => number | null
    }
  }
}

export {}
