import { untrack } from 'svelte'

type LoadingOverlayStateOptions = {
  fadeMs: number
  startsVisible?: boolean
  isLoading?: () => boolean
}

type OverlayPhase = 'hidden' | 'visible' | 'fading'

export const createLoadingOverlayState = ({
  fadeMs,
  startsVisible = false,
  isLoading: getIsLoading
}: LoadingOverlayStateOptions) => {
  const initialPhase: OverlayPhase = startsVisible ? 'visible' : 'hidden'
  let overlayPhase = $state<OverlayPhase>(initialPhase)
  let hideTimeoutId: number | null = null
  const visible = $derived(overlayPhase !== 'hidden')
  const fading = $derived(overlayPhase === 'fading')

  const setPhase = (nextPhase: OverlayPhase): void => {
    overlayPhase = nextPhase
  }

  const clearHideTimeout = (): void => {
    if (hideTimeoutId !== null) {
      window.clearTimeout(hideTimeoutId)
      hideTimeoutId = null
    }
  }

  const setLoading = (isLoading: boolean): void => {
    if (isLoading) {
      clearHideTimeout()
      if (overlayPhase !== 'visible') {
        setPhase('visible')
      }
      return
    }

    clearHideTimeout()
    if (overlayPhase !== 'visible') {
      return
    }

    setPhase('fading')
    hideTimeoutId = window.setTimeout(() => {
      setPhase('hidden')
      hideTimeoutId = null
    }, fadeMs)
  }

  // Side effect: clear pending fade timers when this state object is destroyed.
  $effect(() => {
    return () => {
      clearHideTimeout()
    }
  })

  if (getIsLoading) {
    // Side effect: keep the overlay phase synchronized with the caller's loading state.
    $effect(() => {
      const nextIsLoading = getIsLoading()
      untrack(() => {
        setLoading(nextIsLoading)
      })
    })
  }

  return {
    setLoading,
    isVisible: (): boolean => visible,
    isFading: (): boolean => fading
  }
}
