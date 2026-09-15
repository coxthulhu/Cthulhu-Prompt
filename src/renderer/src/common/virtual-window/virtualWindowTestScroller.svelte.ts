import { onMount } from 'svelte'

type VirtualWindowTestScrollerOptions = {
  getTestId: () => string
  getScrollTopPx: () => number
  getTotalHeightPx: () => number
  applyUserScrollTop: (nextScrollTop: number) => void
}

export const useVirtualWindowTestScroller = (options: VirtualWindowTestScrollerOptions) => {
  const { getTestId, getScrollTopPx, getTotalHeightPx, applyUserScrollTop } = options

  const registerTestScroller = (): (() => void) | null => {
    const controls = window.svelteVirtualWindowTestControls
    if (!controls?.registerVirtualWindowScroller) return null
    const testId = getTestId()
    controls.registerVirtualWindowScroller(testId, {
      scrollTo: (nextScrollTop) => applyUserScrollTop(nextScrollTop),
      getScrollTop: () => getScrollTopPx(),
      getScrollHeight: () => getTotalHeightPx()
    })
    return () => {
      controls.unregisterVirtualWindowScroller?.(testId)
    }
  }

  // Side effect: register the dev/test scroll hooks for this virtual window.
  onMount(() => {
    const unregisterScroller = registerTestScroller()

    return () => {
      unregisterScroller?.()
    }
  })
}
