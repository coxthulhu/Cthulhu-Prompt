<script lang="ts" generics="TRow extends { kind: string }">
  import {
    type VirtualWindowItem,
    type VirtualWindowRowTypeRegistry,
    type ScrollToWithinWindowBand,
    type ScrollToAndTrackRowCentered,
    type VirtualWindowScrollApi,
    type VirtualWindowViewportMetrics
  } from './virtualWindowTypes'
  import { overlayRowWrapperStyle, rowWrapperStyle } from './virtualWindowRowStyles'
  import VirtualWindowScrollbar from './VirtualWindowScrollbar.svelte'
  import { useVirtualWindowCallbacks } from './virtualWindowCallbacks.svelte.ts'
  import { createVirtualWindowHydrationState } from './virtualWindowHydrationState.svelte.ts'
  import { createVirtualWindowMeasurements } from './virtualWindowMeasurements.svelte.ts'
  import { createVirtualWindowRowsState } from './virtualWindowRowsState.svelte.ts'
  import { createVirtualWindowScrollState } from './virtualWindowScrollState.svelte.ts'
  import { useVirtualWindowTestScroller } from './virtualWindowTestScroller.svelte.ts'

  type VirtualWindowProps = {
    items: VirtualWindowItem<TRow>[]
    rowRegistry: VirtualWindowRowTypeRegistry<TRow>
    getHydrationPriorityEligibility?: (row: TRow) => boolean
    getCenterRowEligibility?: (row: TRow) => boolean
    scrollToWithinWindowBand?: ScrollToWithinWindowBand | null
    scrollToAndTrackRowCentered?: ScrollToAndTrackRowCentered | null
    onCenterRowChange?: (row: TRow | null, rowId: string | null) => void
    onUserScroll?: (scrollTopPx: number) => void
    onScrollTopChange?: (scrollTopPx: number) => void
    scrollApi?: VirtualWindowScrollApi | null
    viewportMetrics?: VirtualWindowViewportMetrics | null
    leftScrollPaddingPx?: number
    rightScrollPaddingPx?: number
    testId?: string
    spacerTestId?: string
  }

  // Generic over row shape; callers provide the concrete discriminated union.
  const DEFAULT_LEFT_SCROLL_PADDING_PX = 24
  const DEFAULT_RIGHT_SCROLL_PADDING_PX = 8
  const WINDOW_BAND_PADDING_PX = 100
  const SCROLLBAR_WIDTH_PX = 10
  const WHEEL_SCROLL_MULTIPLIER = 0.4

  let {
    items,
    rowRegistry,
    getHydrationPriorityEligibility,
    getCenterRowEligibility,
    scrollToWithinWindowBand = $bindable<ScrollToWithinWindowBand | null>(null),
    scrollToAndTrackRowCentered = $bindable<ScrollToAndTrackRowCentered | null>(null),
    onCenterRowChange,
    onUserScroll,
    onScrollTopChange,
    scrollApi = $bindable<VirtualWindowScrollApi | null>(null),
    viewportMetrics = $bindable<VirtualWindowViewportMetrics | null>(null),
    leftScrollPaddingPx = DEFAULT_LEFT_SCROLL_PADDING_PX,
    rightScrollPaddingPx = DEFAULT_RIGHT_SCROLL_PADDING_PX,
    testId = 'virtual-window',
    spacerTestId = 'virtual-window-spacer'
  }: VirtualWindowProps = $props()

  let viewportFrame: HTMLDivElement | null = null

  let isPointerOverWindow = $state(false)

  const { getMeasurementWidth, getViewportHeight, getDevicePixelRatio, getWidthResizeActive } =
    createVirtualWindowMeasurements({
      getViewportFrame: () => viewportFrame,
      getLeftScrollPaddingPx: () => leftScrollPaddingPx,
      getRightScrollPaddingPx: () => rightScrollPaddingPx,
      scrollbarWidthPx: SCROLLBAR_WIDTH_PX
    })

  const measurementWidth = $derived(getMeasurementWidth())
  const viewportHeight = $derived(getViewportHeight())
  const devicePixelRatio = $derived(getDevicePixelRatio())
  const resolvedHydrationPriorityEligibility = $derived.by(() => {
    return (
      getHydrationPriorityEligibility ??
      ((row: TRow) => rowRegistry[row.kind].hydrationPriorityEligible ?? false)
    )
  })
  const resolvedCenterRowEligibility = $derived.by(() => {
    return getCenterRowEligibility ?? ((row: TRow) => rowRegistry[row.kind].centerRowEligible ?? false)
  })

  const { getRowStates, getTotalHeightPx } = createVirtualWindowRowsState({
    getItems: () => items,
    getRowRegistry: () => rowRegistry,
    getMeasurementWidth,
    getViewportHeight,
    getDevicePixelRatio
  })

  const {
    getScrollTopPx,
    getScrollAnchorMode,
    setScrollAnchorMode,
    applyUserScrollTop,
    applyProgrammaticScrollTop,
    getClampedAnchoredScrollTopPx,
    getAnchoredScrollBottomPx,
    getVisibleRows,
    getViewportRows,
    getScrollShadowActive,
    getScrollbarRevealVersion,
    scrollToWithinWindowBand: scrollToWithinWindowBandInternal,
    scrollToAndTrackRowCentered: scrollToAndTrackRowCenteredInternal
  } = createVirtualWindowScrollState({
    getRowStates,
    getTotalHeightPx,
    getViewportHeight,
    getOnUserScroll: () => onUserScroll,
    getOnScrollTopChange: () => onScrollTopChange,
    windowBandPaddingPx: WINDOW_BAND_PADDING_PX
  })

  const {
    getHydrationPriorityByRowId,
    hydrationStateByRowId,
    overlayRowElements,
    registerOverlayRow,
    rowNeedsOverlay,
    shouldDehydrateRow,
    getCenterRowId,
    getCenterRowData
  } = createVirtualWindowHydrationState({
    getRowStates,
    getVisibleRows,
    getViewportRows,
    getRowRegistry: () => rowRegistry,
    getViewportHeight,
    getClampedAnchoredScrollTopPx,
    getAnchoredScrollBottomPx,
    getWidthResizeActive,
    getScrollAnchorMode,
    setScrollAnchorMode,
    getHydrationPriorityEligibility: () => resolvedHydrationPriorityEligibility,
    getCenterRowEligibility: () => resolvedCenterRowEligibility
  })

  const totalHeightPx = $derived(getTotalHeightPx())
  const scrollTopPx = $derived(getScrollTopPx())
  const clampedAnchoredScrollTopPx = $derived(getClampedAnchoredScrollTopPx())
  const visibleRows = $derived(getVisibleRows())
  const scrollShadowActive = $derived(getScrollShadowActive())
  const scrollbarRevealVersion = $derived(getScrollbarRevealVersion())
  const hydrationPriorityByRowId = $derived(getHydrationPriorityByRowId())

  const scrollApiInternal: VirtualWindowScrollApi = {
    scrollTo: (scrollTopPx: number) => applyProgrammaticScrollTop(scrollTopPx),
    getScrollTop: () => getScrollTopPx()
  }

  scrollToWithinWindowBand = scrollToWithinWindowBandInternal
  scrollToAndTrackRowCentered = scrollToAndTrackRowCenteredInternal
  scrollApi = scrollApiInternal

  useVirtualWindowCallbacks({
    getOnCenterRowChange: () => onCenterRowChange,
    getCenterRowId,
    getCenterRowData,
    setViewportMetrics: (metrics) => {
      viewportMetrics = metrics
    },
    getMeasurementWidth,
    getViewportHeight,
    getDevicePixelRatio
  })

  useVirtualWindowTestScroller({
    getTestId: () => testId,
    getScrollTopPx,
    getTotalHeightPx,
    applyUserScrollTop
  })

  const handleWheel = (event: WheelEvent) => {
    if (viewportHeight <= 0) return
    applyUserScrollTop(scrollTopPx + event.deltaY * WHEEL_SCROLL_MULTIPLIER)
  }

  const handleNativeScroll = (event: Event) => {
    const target = event.currentTarget as HTMLElement | null
    if (!target) return
    const delta = target.scrollTop
    if (delta === 0) return
    // Convert browser-driven scrollTop changes (focus/tab reveal) into virtual scroll updates.
    target.scrollTop = 0
    applyUserScrollTop(getScrollTopPx() + delta)
  }
</script>

<div
  class="relative h-full w-full virtual-window-scrollbar-theme"
  role="presentation"
  onmouseenter={() => {
    isPointerOverWindow = true
  }}
  onmouseleave={() => {
    isPointerOverWindow = false
  }}
>
  <div bind:this={viewportFrame} class="flex h-full w-full">
    <div
      class="h-full flex-1 min-w-0"
      style="overflow-anchor: none; overflow: hidden; position: relative;"
      data-testid={testId}
      onwheel={(event) => {
        event.preventDefault()
        handleWheel(event)
      }}
      onscroll={handleNativeScroll}
    >
      <div
        aria-hidden="true"
        data-testid={spacerTestId}
        style={`height:${totalHeightPx}px; width:1px; pointer-events:none;`}
      ></div>

      <div style="position:absolute; inset:0;">
        {#each visibleRows as row (row.id)}
          <div style={rowWrapperStyle(row, clampedAnchoredScrollTopPx, devicePixelRatio)}>
            <div
              style={`width:100%; padding-left:${leftScrollPaddingPx}px; padding-right:${rightScrollPaddingPx}px;`}
            >
              {@render row.snippet({
                index: row.index,
                row: row.rowData,
                rowId: row.id,
                virtualWindowWidthPx: measurementWidth,
                virtualWindowHeightPx: viewportHeight,
                devicePixelRatio,
                rowHeightPx: row.height,
                measuredHeightPx: row.measuredHeightPx,
                hydrationPriority: hydrationPriorityByRowId.get(row.id) ?? Number.POSITIVE_INFINITY,
                shouldDehydrate: shouldDehydrateRow(row),
                overlayRowElement: overlayRowElements.get(row.id) ?? null,
                scrollToWithinWindowBand: scrollToWithinWindowBandInternal,
                scrollToAndTrackRowCentered: scrollToAndTrackRowCenteredInternal,
                onHydrationChange: (isHydrated) => hydrationStateByRowId.set(row.id, isHydrated)
              })}
            </div>
          </div>
        {/each}
      </div>

      <div style="position:absolute; inset:0; overflow:visible; pointer-events:none;">
        {#each visibleRows as row (row.id)}
          {#if rowNeedsOverlay(row)}
            <div style={overlayRowWrapperStyle(row, clampedAnchoredScrollTopPx, devicePixelRatio)}>
              <div
                use:registerOverlayRow={row.id}
                style={`width:100%; position:relative; overflow:visible; padding-left:${leftScrollPaddingPx}px; padding-right:${rightScrollPaddingPx}px;`}
              ></div>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <VirtualWindowScrollbar
      {scrollTopPx}
      viewportHeightPx={viewportHeight}
      {totalHeightPx}
      widthPx={SCROLLBAR_WIDTH_PX}
      {isPointerOverWindow}
      revealVersion={scrollbarRevealVersion}
      onScrollTopChange={(nextScrollTop) => applyUserScrollTop(nextScrollTop)}
    />
  </div>

  <div
    aria-hidden="true"
    class="virtual-window-scroll-shadow"
    class:virtual-window-scroll-shadow--active={scrollShadowActive}
  ></div>
</div>

<style>
  .virtual-window-scrollbar-theme {
    --vscode-scrollbar-shadow: #000000;
    --vscode-scrollbarSlider-background: rgba(121, 121, 121, 0.4);
    --vscode-scrollbarSlider-hoverBackground: rgba(100, 100, 100, 0.7);
    --vscode-scrollbarSlider-activeBackground: rgba(191, 191, 191, 0.4);
  }

  .virtual-window-scroll-shadow {
    position: absolute;
    top: 0;
    left: 3px;
    height: 3px;
    width: 100%;
    display: none;
    pointer-events: none;
    z-index: 10;
    box-shadow: var(--vscode-scrollbar-shadow) 0 6px 6px -6px inset;
  }

  .virtual-window-scroll-shadow--active {
    display: block;
  }
</style>
