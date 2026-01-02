/// <reference types="svelte" />
/// <reference types="vite/client" />

declare global {
  interface Window {
    svelteVirtualWindowTestControls?: {
      pauseMonacoHydration: () => void
      resumeMonacoHydration: () => void
      setMonacoHydrationPaused: (next: boolean) => void
    }
  }
}

export {}
