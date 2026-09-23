/// <reference types="svelte" />
/// <reference types="vite/client" />

declare global {
  interface Window {
    /** Persistence observers and worker-response gates installed only in Playwright runs. */
    playwrightTestControls?: {
      /** Holds real worker replies until an editor-recycling test releases them. */
      tokenization: {
        /** Starts holding tokenization replies. */
        pause: () => void
        /** Counts replies that arrived from the worker while held. */
        getHeldReplyCount: (modelPath: string) => number
        /** Delivers held replies through the real TextMate handler. */
        release: () => Promise<void>
      }
      /** Reports debounce and in-flight autosave work without submitting it early. */
      hasPendingAutosaves: () => boolean
      /** Waits for queued mutations and their resulting Svelte effects. */
      waitForMutations: () => Promise<void>
    }
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
      scrollTo?: (testId: string, scrollTopPx: number) => Promise<void>
      getScrollTop?: (testId: string) => number | null
      getScrollHeight?: (testId: string) => number | null
    }
  }
}

export {}
