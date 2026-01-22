import {
  computeAnchoredScrollTop,
  findIndexAtOffset
} from './virtualWindowRowUtils'
import type { VirtualRowState } from './virtualWindowRows'
import type {
  ScrollToWithinWindowBand,
  ScrollToWithinWindowBandType,
  ScrollToAndTrackRowCentered
} from './virtualWindowTypes'

type VirtualWindowScrollStateOptions<TRow extends { kind: string }> = {
  getRowStates: () => VirtualRowState<TRow>[]
  getTotalHeightPx: () => number
  getViewportHeight: () => number
  getOnUserScroll: () => ((scrollTopPx: number) => void) | undefined
  getOnScrollTopChange: () => ((scrollTopPx: number) => void) | undefined
  windowBandPaddingPx: number
}

export const createVirtualWindowScrollState = <TRow extends { kind: string }>(
  options: VirtualWindowScrollStateOptions<TRow>
) => {
  const {
    getRowStates,
    getTotalHeightPx,
    getViewportHeight,
    getOnUserScroll,
    getOnScrollTopChange,
    windowBandPaddingPx
  } = options

  let scrollTopPx = $state(0)
  let scrollAnchorMode = $state<'top' | 'center'>('top')
  let previousRowStates = $state<VirtualRowState<TRow>[]>([])
  let scrollbarRevealVersion = $state(0)
  let lastScrollTop = 0
  let trackedRowId = $state<string | null>(null)

  const maxScrollTopPx = $derived(Math.max(0, getTotalHeightPx() - getViewportHeight()))
  const scrollShadowActive = $derived(scrollTopPx > 0)
  const anchorOffsetPx = $derived(
    scrollAnchorMode === 'center' ? getViewportHeight() / 2 : 0
  )

  const clampScrollTop = (nextScrollTop: number): number => {
    return Math.min(Math.max(0, nextScrollTop), maxScrollTopPx)
  }

  const applyScrollTop = (nextScrollTop: number, isUserScroll: boolean): boolean => {
    const clampedScrollTop = clampScrollTop(nextScrollTop)
    if (clampedScrollTop === scrollTopPx) return false
    scrollTopPx = clampedScrollTop
    if (isUserScroll && scrollAnchorMode === 'center') {
      scrollAnchorMode = 'top'
    }
    getOnScrollTopChange()?.(scrollTopPx)
    return true
  }

  const applyUserScrollTop = (nextScrollTop: number) => {
    trackedRowId = null
    const didScroll = applyScrollTop(nextScrollTop, true)
    if (didScroll) {
      getOnUserScroll()?.(scrollTopPx)
    }
  }

  const applyProgrammaticScrollTop = (nextScrollTop: number) => {
    applyScrollTop(nextScrollTop, false)
  }

  // Anchor viewport math to the scroll position we will apply after layout changes.
  const anchoredScrollTopPx = $derived.by(() =>
    computeAnchoredScrollTop(previousRowStates, getRowStates(), scrollTopPx, anchorOffsetPx)
  )
  const clampedAnchoredScrollTopPx = $derived(clampScrollTop(anchoredScrollTopPx))
  const anchoredScrollBottomPx = $derived(clampedAnchoredScrollTopPx + getViewportHeight())

  const OVERSCAN_PX = 1000

  // Overscan the viewport so rows above/below are rendered ahead of scroll.
  const overscannedTopPx = $derived(Math.max(0, clampedAnchoredScrollTopPx - OVERSCAN_PX))
  const overscannedBottomPx = $derived(anchoredScrollBottomPx + OVERSCAN_PX)

  const visibleStartIndex = $derived(findIndexAtOffset(getRowStates(), overscannedTopPx))
  const visibleEndIndex = $derived.by(() => {
    const rowStates = getRowStates()
    if (rowStates.length === 0) return -1
    const end = findIndexAtOffset(rowStates, overscannedBottomPx)
    if (visibleStartIndex < 0) return end
    return Math.max(visibleStartIndex, end)
  })

  const visibleRows = $derived.by(() => {
    if (visibleStartIndex < 0 || visibleEndIndex < visibleStartIndex) return []
    return getRowStates().slice(visibleStartIndex, visibleEndIndex + 1)
  })

  const setScrollAnchorMode = (next: 'top' | 'center') => {
    scrollAnchorMode = next
  }

  const scrollToWithinWindowBand: ScrollToWithinWindowBand = (
    rowId: string,
    offsetPx: number,
    scrollType: ScrollToWithinWindowBandType
  ) => {
    const viewportHeight = getViewportHeight()
    if (viewportHeight <= 0) return

    const rowStates = getRowStates()
    const row = rowStates.find((candidate) => candidate.id === rowId)
    if (!row) return

    const targetOffsetPx = row.offset + offsetPx
    const bandTopPx = scrollTopPx + windowBandPaddingPx
    const bandBottomPx = scrollTopPx + viewportHeight - windowBandPaddingPx

    if (targetOffsetPx >= bandTopPx && targetOffsetPx <= bandBottomPx) return

    let nextScrollTop = scrollTopPx

    if (scrollType === 'center') {
      nextScrollTop = targetOffsetPx - viewportHeight / 2
    } else if (targetOffsetPx < bandTopPx) {
      nextScrollTop = targetOffsetPx - windowBandPaddingPx
    } else {
      nextScrollTop = targetOffsetPx + windowBandPaddingPx - viewportHeight
    }

    nextScrollTop = clampScrollTop(nextScrollTop)
    if (nextScrollTop === scrollTopPx) return

    applyProgrammaticScrollTop(nextScrollTop)

    if (scrollType === 'center') {
      scrollAnchorMode = 'center'
    }
  }

  const TRACKED_ROW_TOP_PADDING_PX = 100

  const getTrackedRowScrollTop = (
    row: VirtualRowState<TRow>,
    viewportHeight: number
  ): number => {
    if (row.height + TRACKED_ROW_TOP_PADDING_PX > viewportHeight) {
      return row.offset - TRACKED_ROW_TOP_PADDING_PX
    }
    return row.offset + row.height / 2 - viewportHeight / 2
  }

  const scrollToAndTrackRowCentered: ScrollToAndTrackRowCentered = (rowId: string) => {
    const viewportHeight = getViewportHeight()
    if (viewportHeight <= 0) return

    const rowStates = getRowStates()
    const row = rowStates.find((candidate) => candidate.id === rowId)
    if (!row) return

    trackedRowId = rowId
    const nextScrollTop = clampScrollTop(getTrackedRowScrollTop(row, viewportHeight))
    if (nextScrollTop === scrollTopPx) return

    applyProgrammaticScrollTop(nextScrollTop)

    scrollAnchorMode = 'center'
  }

  // Side effect: anchor scroll position to the active anchor row when layout or viewport changes.
  $effect(() => {
    if (clampedAnchoredScrollTopPx !== scrollTopPx) {
      applyProgrammaticScrollTop(clampedAnchoredScrollTopPx)
    }

    previousRowStates = getRowStates()
    void getViewportHeight()
  })

  // Side effect: keep the tracked row aligned as measurements change.
  $effect(() => {
    const rowId = trackedRowId
    if (!rowId) return
    const viewportHeight = getViewportHeight()
    if (viewportHeight <= 0) return

    const row = getRowStates().find((candidate) => candidate.id === rowId)
    if (!row) return

    const nextScrollTop = clampScrollTop(getTrackedRowScrollTop(row, viewportHeight))
    if (nextScrollTop === scrollTopPx) return
    applyProgrammaticScrollTop(nextScrollTop)
  })

  // Side effect: reveal the scrollbar briefly after scroll changes.
  $effect(() => {
    if (scrollTopPx === lastScrollTop) return
    lastScrollTop = scrollTopPx
    scrollbarRevealVersion += 1
  })

  return {
    getScrollTopPx: () => scrollTopPx,
    getScrollAnchorMode: () => scrollAnchorMode,
    setScrollAnchorMode,
    applyUserScrollTop,
    applyProgrammaticScrollTop,
    getClampedAnchoredScrollTopPx: () => clampedAnchoredScrollTopPx,
    getAnchoredScrollBottomPx: () => anchoredScrollBottomPx,
    getVisibleRows: () => visibleRows,
    getScrollShadowActive: () => scrollShadowActive,
    getScrollbarRevealVersion: () => scrollbarRevealVersion,
    scrollToWithinWindowBand,
    scrollToAndTrackRowCentered
  }
}
