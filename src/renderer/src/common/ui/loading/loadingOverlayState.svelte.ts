type LoadingOverlayStateOptions = {
  fadeMs: number
  startsVisible?: boolean
  getIsLoading?: () => boolean
}

export const createLoadingOverlayState = ({
  fadeMs,
  startsVisible = false,
  getIsLoading
}: LoadingOverlayStateOptions) => {
  const initialPhase: 'hidden' | 'visible' | 'fading' = startsVisible ? 'visible' : 'hidden'
  let overlayPhase = $state<'hidden' | 'visible' | 'fading'>(initialPhase)
  let currentPhase: 'hidden' | 'visible' | 'fading' = initialPhase
  let hideTimeoutId: number | null = null
  const isVisible = $derived(overlayPhase !== 'hidden')
  const isFading = $derived(overlayPhase === 'fading')

  const setPhase = (nextPhase: 'hidden' | 'visible' | 'fading'): void => {
    currentPhase = nextPhase
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
      if (currentPhase !== 'visible') {
        setPhase('visible')
      }
      return
    }

    clearHideTimeout()
    if (currentPhase !== 'visible') {
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
      setLoading(getIsLoading())
    })
  }

  return {
    setLoading,
    getIsVisible: (): boolean => isVisible,
    getIsFading: (): boolean => isFading
  }
}
