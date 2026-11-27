import { untrack } from 'svelte'
import { computeAnchoredScrollTop, findIndexAtOffset } from './virtualWindowRowUtils'
import type { VirtualRowState, VirtualWindowResizeAnchor } from './virtualWindowRows'
import type {
  ScrollToWithinWindowBand,
  ScrollToWithinWindowBandType,
  ScrollToAndTrackRow,
  TrackedRowScrollPlacement
} from './virtualWindowTypes'

type VirtualWindowScrollStateOptions<TRow extends { kind: string }> = {
  getRowStates: () => VirtualRowState<TRow>[]
  getTotalHeightPx: () => number
  getViewportHeight: () => number
  getOnUserScroll: () => ((scrollTopPx: number) => void) | undefined
  getOnScrollTopChange: () => ((scrollTopPx: number) => void) | undefined
  windowBandPaddingPx: number
  getInitialScrollTopPx: () => number | null
  /** Checks hydration before invoking an exact offset measurement. */
  isRowHydrated?: (row: VirtualRowState<TRow>) => boolean
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
    windowBandPaddingPx,
    getInitialScrollTopPx
  } = options

  const initialScrollTopPx = getInitialScrollTopPx()
  let scrollTopPx = $state(Math.max(0, initialScrollTopPx ?? 0))
  let scrollAnchorMode = $state<'top' | 'center'>('top')
  let previousRowStates = $state<VirtualRowState<TRow>[]>([])
  let scrollbarRevealVersion = $state(0)
  let lastScrollTop = 0
  /** Preserves the visible prompt while its editor measures the new width. */
  let resizeAnchor = $state.raw<VirtualWindowResizeAnchor | null>(null)
  /** Single row placement retained while virtual measurements settle. */
  let trackedRow = $state<{ rowId: string; placement: TrackedRowScrollPlacement } | null>(null)
  /** One measured reveal whose row stays mounted until completion or cancellation. */
  let pendingMeasurement = $state.raw<{
    rowId: string
    measure: () => number | null
    scrollType: ScrollToWithinWindowBandType
    scrollPaddingPx: number
  } | null>(null)

  /** Releases pending placements when user scrolling or explicit navigation takes over. */
  const cancelPendingScroll = (): void => {
    pendingMeasurement = null
    resizeAnchor = null
  }

  const maxScrollTopPx = $derived(Math.max(0, getTotalHeightPx() - getViewportHeight()))
  const anchorOffsetPx = $derived(scrollAnchorMode === 'center' ? getViewportHeight() / 2 : 0)

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
    cancelPendingScroll()
    trackedRow = null
    const didScroll = applyScrollTop(nextScrollTop, true)
    if (didScroll) {
      getOnUserScroll()?.(scrollTopPx)
    }
  }

  const applyProgrammaticScrollTop = (nextScrollTop: number) => {
    applyScrollTop(nextScrollTop, false)
  }

  /** Current geometry of the row captured at the start of a width change. */
  const resizingRow = $derived(resizeAnchor && getRowStates().find((row) => row.id === resizeAnchor!.rowId))

  // Resolve one position for rendering and scroll updates, giving active tracking priority.
  const resolvedScrollTopPx = $derived.by(() => {
    const rowStates = getRowStates()
    const viewportHeight = getViewportHeight()
    const tracked = trackedRow
    if (tracked && scrollAnchorMode === 'center' && viewportHeight > 0) {
      const row = rowStates.find((candidate) => candidate.id === tracked.rowId)
      if (row) {
        return clampScrollTop(getTrackedRowScrollTop(row, viewportHeight, tracked.placement))
      }
    }
    if (resizeAnchor && resizingRow) {
      // A genuinely shorter row can retain the viewport only as far as its last pixel.
      const offset = resizeAnchor.offsetInRow < resizingRow.height
        ? resizeAnchor.offsetInRow
        : Math.max(0, resizingRow.height - 1)
      return clampScrollTop(resizingRow.offset + offset)
    }
    return clampScrollTop(
      computeAnchoredScrollTop(previousRowStates, rowStates, scrollTopPx, anchorOffsetPx)
    )
  })
  const resolvedScrollBottomPx = $derived(resolvedScrollTopPx + getViewportHeight())
  const scrollShadowActive = $derived(resolvedScrollTopPx > 0)

  const OVERSCAN_PX = 400
  /** Overscan in effect; zero until the window's first frame paints, so mounting renders only the visible rows. */
  let overscanPx = $state(0)

  // Side effect: add the overscan rows in the frame after the window's visible rows first paint.
  $effect(() => {
    let frameHandle = requestAnimationFrame(() => {
      frameHandle = requestAnimationFrame(() => {
        overscanPx = OVERSCAN_PX
      })
    })
    return () => cancelAnimationFrame(frameHandle)
  })

  // Overscan the viewport so rows above/below are rendered ahead of scroll.
  const overscannedTopPx = $derived(Math.max(0, resolvedScrollTopPx - overscanPx))
  const overscannedBottomPx = $derived(resolvedScrollBottomPx + overscanPx)

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
    /** Normal overscan rows plus, at most, the row being prepared for exact measurement. */
    const rows = getRowStates().slice(visibleStartIndex, visibleEndIndex + 1)
    /** Distant target mounted at its actual content offset without moving the viewport. */
    const pendingRow = pendingMeasurement
      ? getRowStates().find((row) => row.id === pendingMeasurement!.rowId)
      : null
    if (pendingRow && !rows.includes(pendingRow)) rows.push(pendingRow)
    return rows
  })

  const viewportStartIndex = $derived(findIndexAtOffset(getRowStates(), resolvedScrollTopPx))
  const viewportEndIndex = $derived.by(() => {
    const rowStates = getRowStates()
    if (rowStates.length === 0) return -1
    const end = findIndexAtOffset(rowStates, resolvedScrollBottomPx)
    if (viewportStartIndex < 0) return end
    return Math.max(viewportStartIndex, end)
  })
  const viewportRows = $derived.by(() => {
    if (viewportStartIndex < 0 || viewportEndIndex < viewportStartIndex) return []
    return getRowStates().slice(viewportStartIndex, viewportEndIndex + 1)
  })

  /** Captures the top row in the old layout before its exact measurement becomes unavailable. */
  const captureResizeAnchor = (): void => {
    if (scrollAnchorMode !== 'top' || pendingMeasurement || resizeAnchor) return
    /** First visible row at the old width. Fixed-height rows already keep their position. */
    const row = viewportRows[0]
    if (row?.measuredHeightPx == null) return
    resizeAnchor = { rowId: row.id, height: row.height, offsetInRow: resolvedScrollTopPx - row.offset }
  }

  const setScrollAnchorMode = (next: 'top' | 'center') => {
    scrollAnchorMode = next
  }

  const compensateForRowMove = (
    sourceRowId: string,
    sourceTrailingRowId: string,
    destinationDividerRowId: string
  ): void => {
    cancelPendingScroll()
    const rows = getRowStates()
    const sourceRow = rows.find((row) => row.id === sourceRowId)
    const sourceTrailingRow = rows.find((row) => row.id === sourceTrailingRowId)
    const destinationDividerRow = rows.find((row) => row.id === destinationDividerRowId)
    if (!sourceRow || !sourceTrailingRow || !destinationDividerRow) return

    let destinationTop = destinationDividerRow.offset + destinationDividerRow.height
    if (sourceRow.offset < destinationDividerRow.offset) {
      destinationTop -= sourceRow.height + sourceTrailingRow.height
    }
    applyProgrammaticScrollTop(
      resolvedScrollTopPx + destinationTop - sourceRow.offset
    )
  }

  /** Applies the existing band rule to an available numeric measurement. */
  const scrollToOffsetWithinWindowBand = (
    rowId: string,
    offsetPx: number,
    scrollType: ScrollToWithinWindowBandType,
    scrollPaddingPx = windowBandPaddingPx
  ) => {
    const viewportHeight = getViewportHeight()
    if (viewportHeight <= 0) return

    const rowStates = getRowStates()
    const row = rowStates.find((candidate) => candidate.id === rowId)
    if (!row) return

    const targetOffsetPx = row.offset + offsetPx
    // Collapse a symmetric band that cannot fit in the viewport to its center point.
    const bandPaddingPx = Math.min(
      scrollType === 'minimal' ? scrollPaddingPx : windowBandPaddingPx,
      viewportHeight / 2
    )
    const bandTopPx = scrollTopPx + bandPaddingPx
    const bandBottomPx = scrollTopPx + viewportHeight - bandPaddingPx

    if (targetOffsetPx >= bandTopPx && targetOffsetPx <= bandBottomPx) {
      return
    }

    let nextScrollTop = scrollTopPx

    if (scrollType === 'center') {
      nextScrollTop = targetOffsetPx - viewportHeight / 2
    } else if (targetOffsetPx < bandTopPx) {
      nextScrollTop = targetOffsetPx - bandPaddingPx
    } else {
      nextScrollTop = targetOffsetPx + bandPaddingPx - viewportHeight
    }

    nextScrollTop = clampScrollTop(nextScrollTop)
    if (nextScrollTop === scrollTopPx) return

    applyProgrammaticScrollTop(nextScrollTop)

    if (scrollType === 'center') {
      scrollAnchorMode = 'center'
    }
  }

  /** Completes an exact reveal synchronously when mounting and hydration have finished. */
  const completePendingMeasurement = (): void => {
    /** Request identity protects a newer reveal from cancellation during measurement. */
    const request = pendingMeasurement
    if (!request) return
    /** Latest row geometry, including the height reported by Monaco's initial layout. */
    const row = getRowStates().find((candidate) => candidate.id === request.rowId)
    if (!row || !(options.isRowHydrated?.(row) ?? true)) return
    /** Exact target offset; null waits for another readiness notification. */
    const offsetPx = request.measure()
    if (pendingMeasurement !== request || offsetPx === null) return
    pendingMeasurement = null
    // Commit current anchoring before measuring the band so the layout is not applied twice.
    scrollTopPx = resolvedScrollTopPx
    previousRowStates = getRowStates()
    scrollToOffsetWithinWindowBand(
      request.rowId, offsetPx, request.scrollType, request.scrollPaddingPx
    )
  }

  /** Keeps numeric reveals immediate and prepares callback targets without a preliminary scroll. */
  const scrollToWithinWindowBand: ScrollToWithinWindowBand = (
    rowId, offset, scrollType, scrollPaddingPx = windowBandPaddingPx
  ) => {
    cancelPendingScroll()
    trackedRow = null
    if (typeof offset === 'number') {
      scrollToOffsetWithinWindowBand(rowId, offset, scrollType, scrollPaddingPx)
      return () => {}
    }
    /** Stable request object retained by its cancellation closure. */
    const request = { rowId, measure: offset, scrollType, scrollPaddingPx }
    pendingMeasurement = request
    completePendingMeasurement()
    return () => {
      if (pendingMeasurement === request) pendingMeasurement = null
    }
  }

  const TRACKED_ROW_TOP_PADDING_PX = 100
  /** Minimum viewport-top offset retained by vertical-bias placement. */
  const MINIMUM_TRACKED_ROW_TOP_OFFSET_PX = 20

  /** Resolves the scroll top for the tracked row's current measured height. */
  const getTrackedRowScrollTop = (
    row: VirtualRowState<TRow>,
    viewportHeight: number,
    placement: TrackedRowScrollPlacement
  ): number => {
    if (placement.type === 'vertical-bias') {
      /** Largest symmetric top and bottom offset available around the complete row. */
      const availableSymmetricOffsetPx = (viewportHeight - row.height) / 2
      /** Bias reduced symmetrically as needed, while keeping the row at least 20px from the top. */
      const effectiveVerticalBiasPx = Math.max(
        MINIMUM_TRACKED_ROW_TOP_OFFSET_PX,
        Math.min(placement.verticalBiasPx, availableSymmetricOffsetPx)
      )
      return row.offset - effectiveVerticalBiasPx
    }

    if (row.height + TRACKED_ROW_TOP_PADDING_PX > viewportHeight) {
      return row.offset - TRACKED_ROW_TOP_PADDING_PX
    }
    return row.offset + row.height / 2 - viewportHeight / 2
  }

  /** Starts the one active tracked-row placement. */
  const scrollToAndTrackRow: ScrollToAndTrackRow = (rowId, placement) => {
    cancelPendingScroll()
    const viewportHeight = getViewportHeight()
    if (viewportHeight <= 0) return

    const rowStates = getRowStates()
    const row = rowStates.find((candidate) => candidate.id === rowId)
    if (!row) return

    trackedRow = { rowId, placement }
    scrollAnchorMode = 'center'
    applyProgrammaticScrollTop(resolvedScrollTopPx)
  }

  // Side effect: commit the chosen placement and retain the latest layout for the tracking handoff.
  $effect(() => {
    const rowStates = getRowStates()
    const viewportHeight = getViewportHeight()
    const tracked = trackedRow
    if (
      tracked &&
      (scrollAnchorMode !== 'center' || !rowStates.some((row) => row.id === tracked.rowId))
    ) {
      trackedRow = null
    }
    if (rowStates.length === 0 || viewportHeight <= 0) return

    const nextScrollTop = resolvedScrollTopPx
    // Callback reads must not make this effect depend on the consumer's state.
    untrack(() => {
      applyProgrammaticScrollTop(nextScrollTop)
      previousRowStates = rowStates
      // Ordinary top anchoring resumes from the committed position at the measured width.
      if (resizeAnchor && (!resizingRow || resizingRow.measuredHeightPx !== null)) resizeAnchor = null
    })
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
    getResolvedScrollTopPx: () => resolvedScrollTopPx,
    getResolvedScrollBottomPx: () => resolvedScrollBottomPx,
    getVisibleRows: () => visibleRows,
    getViewportRows: () => viewportRows,
    getScrollShadowActive: () => scrollShadowActive,
    getScrollbarRevealVersion: () => scrollbarRevealVersion,
    scrollToWithinWindowBand,
    completePendingMeasurement,
    cancelPendingScroll,
    captureResizeAnchor,
    /** Old row dimensions used only as a provisional height during resize. */
    getResizeAnchor: (): VirtualWindowResizeAnchor | null => resizeAnchor,
    /** Pending target receives hydration priority ahead of ordinary overscan rows. */
    getPendingMeasurementRowId: () => pendingMeasurement?.rowId ?? null,
    scrollToAndTrackRow,
    compensateForRowMove
  }
}
