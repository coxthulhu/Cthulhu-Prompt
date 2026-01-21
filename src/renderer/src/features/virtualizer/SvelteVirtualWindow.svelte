<script lang="ts" generics="TRow extends { kind: string }">
  import { onMount } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import {
    type VirtualWindowItem,
    type VirtualWindowRowSnippet,
    type VirtualWindowRowTypeRegistry,
    type ScrollToWithinWindowBand,
    type ScrollToWithinWindowBandType,
    type ScrollToRowCentered
  } from './virtualWindowTypes'
  import VirtualWindowScrollbar from './VirtualWindowScrollbar.svelte'

  type VirtualWindowProps = {
    items: VirtualWindowItem<TRow>[]
    rowRegistry: VirtualWindowRowTypeRegistry<TRow>
    getHydrationPriorityEligibility?: (row: TRow) => boolean
    getCenterRowEligibility?: (row: TRow) => boolean
    onScrollToWithinWindowBand?: (scrollToWithinWindowBand: ScrollToWithinWindowBand) => void
    onScrollToRowCentered?: (scrollToRowCentered: ScrollToRowCentered) => void
    onCenterRowChange?: (row: TRow | null, rowId: string | null) => void
    onUserScroll?: (scrollTopPx: number) => void
    onViewportMetricsChange?: (metrics: {
      widthPx: number
      heightPx: number
      devicePixelRatio: number
    }) => void
    testId?: string
    spacerTestId?: string
  }

  // Generic over row shape; callers provide the concrete discriminated union.
  let {
    items,
    rowRegistry,
    getHydrationPriorityEligibility,
    getCenterRowEligibility,
    onScrollToWithinWindowBand,
    onScrollToRowCentered,
    onCenterRowChange,
    onUserScroll,
    onViewportMetricsChange,
    testId = 'virtual-window',
    spacerTestId = 'virtual-window-spacer'
  }: VirtualWindowProps = $props()

  type VirtualRowState<TRow extends { kind: string }> = {
    id: string
    index: number
    offset: number
    height: number
    measuredHeightPx: number | null
    rowData: TRow
    snippet: VirtualWindowRowSnippet<TRow>
  }

  type RowState = VirtualRowState<TRow>

  let viewportFrame: HTMLDivElement | null = null
  let lastScrollToWithinWindowBandCallback:
    | ((scrollToWithinWindowBand: ScrollToWithinWindowBand) => void)
    | null = null
  let lastScrollToRowCenteredCallback: ((scrollToRowCentered: ScrollToRowCentered) => void) | null =
    null
  let lastCenterRowChangeCallback: ((row: TRow | null, rowId: string | null) => void) | null = null
  let lastCenterRowId: string | null = null
  let lastViewportMetricsCallback:
    | ((metrics: { widthPx: number; heightPx: number; devicePixelRatio: number }) => void)
    | null = null
  let lastViewportMetrics:
    | { widthPx: number; heightPx: number; devicePixelRatio: number }
    | null = null

  let containerWidth = $state(0)
  let devicePixelRatio = $state(1)
  let hasInitializedWidth = false
  let previousWidthPx = 0
  let widthResizeActive = $state(false)
  let widthResizeVersion = 0

  const LEFT_SCROLL_PADDING_PX = 24
  const RIGHT_SCROLL_PADDING_PX = 8
  const WINDOW_BAND_PADDING_PX = 100
  const SCROLLBAR_WIDTH_PX = 10

  // Subtract internal padding so width-based height measurements match the row content width.
  const measurementWidth = $derived(
    Math.max(
      0,
      containerWidth - LEFT_SCROLL_PADDING_PX - RIGHT_SCROLL_PADDING_PX - SCROLLBAR_WIDTH_PX
    )
  )

  const findIndexAtOffset = (rows: readonly RowState[], offset: number): number => {
    if (rows.length === 0) return -1

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      const end = row.offset + row.height
      if (offset < end) return i
    }

    return rows.length - 1
  }

  const computeAnchoredScrollTop = (
    previousRows: readonly RowState[],
    nextRows: readonly RowState[],
    scrollTop: number,
    anchorOffsetPx: number
  ): number => {
    const anchorPositionPx = scrollTop + anchorOffsetPx
    const anchorRow = previousRows[findIndexAtOffset(previousRows, anchorPositionPx)]
    if (!anchorRow) return scrollTop
    const offsetInRow = anchorPositionPx - anchorRow.offset
    const nextRow = nextRows.find((row) => row.id === anchorRow.id)
    return nextRow ? nextRow.offset + offsetInRow - anchorOffsetPx : scrollTop
  }

  const resolveRowHeight = (estimated: number, measured: number | null): number => {
    if (measured != null && Number.isFinite(measured)) return measured
    return estimated
  }

  const normalizeEstimatedHeight = (estimatedHeight: number): number => {
    if (estimatedHeight <= 0) return 0
    return Math.ceil(estimatedHeight / 4) * 4
  }

  const findNearestEligibleRow = (
    rows: readonly RowState[],
    centerPx: number,
    isEligible?: (row: TRow) => boolean
  ): RowState | null => {
    if (rows.length === 0) return null

    let candidate: RowState | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    rows.forEach((row) => {
      if (isEligible && !isEligible(row.rowData)) return
      const rowCenterPx = row.offset + row.height / 2
      const distance = Math.abs(rowCenterPx - centerPx)
      if (distance < bestDistance) {
        bestDistance = distance
        candidate = row
      }
    })

    return candidate
  }

  const buildRows = (
    nextItems: VirtualWindowItem<TRow>[],
    registry: VirtualWindowRowTypeRegistry<TRow>,
    width: number,
    viewportHeightPx: number,
    dpr: number
  ): RowState[] => {
    const rows: RowState[] = []
    let offset = 0

    nextItems.forEach((item, index) => {
      const entry = registry[item.row.kind]
      const estimatedHeight = normalizeEstimatedHeight(
        entry.estimateHeight(item.row, width, viewportHeightPx)
      )
      const measuredHeightPx = entry.lookupMeasuredHeight?.(item.row, width, dpr) ?? null
      const height = resolveRowHeight(estimatedHeight, measuredHeightPx)

      rows.push({
        id: item.id,
        index,
        offset,
        height,
        measuredHeightPx,
        rowData: item.row,
        snippet: entry.snippet
      })

      offset += height
    })

    return rows
  }

  let scrollTopPx = $state(0)
  let viewportHeight = $state(0)
  let previousRowStates = $state<RowState[]>([])
  let scrollAnchorMode = $state<'top' | 'center'>('top')
  let isPointerOverWindow = $state(false)
  let scrollbarRevealVersion = $state(0)
  let lastScrollTop = 0

  const rowStates = $derived.by(() => {
    if (measurementWidth <= 0) return []
    return buildRows(items, rowRegistry, measurementWidth, viewportHeight, devicePixelRatio)
  })
  const rowHeightsPx = $derived(rowStates.map((row) => row.height))
  const totalHeightPx = $derived(
    rowHeightsPx.length === 0 ? 0 : rowHeightsPx.reduce((sum, height) => sum + height, 0)
  )
  const maxScrollTopPx = $derived(Math.max(0, totalHeightPx - viewportHeight))

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
    return true
  }

  const applyUserScrollTop = (nextScrollTop: number) => {
    const didScroll = applyScrollTop(nextScrollTop, true)
    if (didScroll) {
      onUserScroll?.(scrollTopPx)
    }
  }

  const applyProgrammaticScrollTop = (nextScrollTop: number) => {
    applyScrollTop(nextScrollTop, false)
  }

  const hydrationStateByRowId = new SvelteMap<string, boolean>()
  const overlayRowElements = new SvelteMap<string, HTMLDivElement>()

  const scrollShadowActive = $derived(scrollTopPx > 0)

  const anchorOffsetPx = $derived(scrollAnchorMode === 'center' ? viewportHeight / 2 : 0)

  // Anchor viewport math to the scroll position we will apply after layout changes.
  const anchoredScrollTopPx = $derived.by(() =>
    computeAnchoredScrollTop(previousRowStates, rowStates, scrollTopPx, anchorOffsetPx)
  )
  const clampedAnchoredScrollTopPx = $derived(clampScrollTop(anchoredScrollTopPx))
  const anchoredScrollBottomPx = $derived(clampedAnchoredScrollTopPx + viewportHeight)

  const OVERSCAN_PX = 1000

  // Overscan the viewport so rows above/below are rendered ahead of scroll.
  const overscannedTopPx = $derived(Math.max(0, clampedAnchoredScrollTopPx - OVERSCAN_PX))
  const overscannedBottomPx = $derived(anchoredScrollBottomPx + OVERSCAN_PX)

  const visibleStartIndex = $derived(findIndexAtOffset(rowStates, overscannedTopPx))
  const visibleEndIndex = $derived.by(() => {
    if (rowStates.length === 0) return -1
    const end = findIndexAtOffset(rowStates, overscannedBottomPx)
    if (visibleStartIndex < 0) return end
    return Math.max(visibleStartIndex, end)
  })

  const visibleRows = $derived.by(() => {
    if (visibleStartIndex < 0 || visibleEndIndex < visibleStartIndex) return []
    return rowStates.slice(visibleStartIndex, visibleEndIndex + 1)
  })

  // Derive hydration priorities so rows closest to the viewport center hydrate first.
  const hydrationPriorityByRowId = $derived.by(() => {
    if (!getHydrationPriorityEligibility) return new SvelteMap<string, number>()
    if (visibleRows.length === 0) return new SvelteMap<string, number>()

    const viewportCenterPx = clampedAnchoredScrollTopPx + viewportHeight / 2
    const candidates = visibleRows
      .filter((row) => getHydrationPriorityEligibility(row.rowData))
      .map((row) => ({
        id: row.id,
        index: row.index,
        distance: Math.abs(row.offset + row.height / 2 - viewportCenterPx)
      }))

    candidates.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance
      return a.index - b.index
    })

    const priorities = new SvelteMap<string, number>()
    candidates.forEach((candidate, priority) => {
      priorities.set(candidate.id, priority)
    })

    return priorities
  })

  const centerRow = $derived.by(() => {
    if (rowStates.length === 0 || viewportHeight <= 0) return null
    const viewportCenterPx = clampedAnchoredScrollTopPx + viewportHeight / 2
    return findNearestEligibleRow(rowStates, viewportCenterPx, getCenterRowEligibility)
  })
  const centerRowId = $derived(centerRow?.id ?? null)
  const centerRowData = $derived(centerRow?.rowData ?? null)

  const snapToDevicePixels = (value: number, dpr: number): number => {
    if (!Number.isFinite(value) || !Number.isFinite(dpr) || dpr <= 0) return value
    return Math.round(value * dpr) / dpr
  }

  const rowWrapperStyle = (row: RowState): string => {
    const translateY = snapToDevicePixels(row.offset - clampedAnchoredScrollTopPx, devicePixelRatio)
    return [
      'position:absolute',
      'top:0',
      'left:0',
      'width:100%',
      `transform:translate3d(0, ${translateY}px, 0)`,
      'contain:layout paint style',
      `height:${row.height}px`,
      `min-height:${row.height}px`,
      `max-height:${row.height}px`
    ].join(';')
  }

  const overlayRowWrapperStyle = (row: RowState): string => {
    const translateY = snapToDevicePixels(row.offset - clampedAnchoredScrollTopPx, devicePixelRatio)
    return [
      'position:absolute',
      'top:0',
      'left:0',
      'width:100%',
      `transform:translate3d(0, ${translateY}px, 0)`,
      'overflow:visible',
      'pointer-events:none',
      `height:${row.height}px`,
      `min-height:${row.height}px`,
      `max-height:${row.height}px`
    ].join(';')
  }

  const rowNeedsOverlay = (row: RowState): boolean =>
    rowRegistry[row.rowData.kind].needsOverlayRow ?? false

  const registerOverlayRow = (node: HTMLDivElement, rowId: string) => {
    overlayRowElements.set(rowId, node)
    return {
      destroy: () => {
        overlayRowElements.delete(rowId)
      }
    }
  }

  const rowTouchesViewport = (row: RowState): boolean =>
    row.offset + row.height >= clampedAnchoredScrollTopPx && row.offset <= anchoredScrollBottomPx

  const shouldDehydrateRow = (row: RowState): boolean =>
    widthResizeActive && row.rowData.kind === 'prompt-editor' && !rowTouchesViewport(row)


  const registerTestScroller = (): (() => void) | null => {
    const controls = window.svelteVirtualWindowTestControls
    if (!controls?.registerVirtualWindowScroller) return null
    controls.registerVirtualWindowScroller(testId, {
      scrollTo: (nextScrollTop) => applyUserScrollTop(nextScrollTop),
      getScrollTop: () => scrollTopPx,
      getScrollHeight: () => totalHeightPx
    })
    return () => {
      controls.unregisterVirtualWindowScroller?.(testId)
    }
  }

  const isRowHydrated = (row: RowState | null): boolean => {
    if (!row) return true
    if (!getHydrationPriorityEligibility?.(row.rowData)) return true
    return hydrationStateByRowId.get(row.id) ?? false
  }

  const scrollToWithinWindowBand: ScrollToWithinWindowBand = (
    rowId: string,
    offsetPx: number,
    scrollType: ScrollToWithinWindowBandType
  ) => {
    if (viewportHeight <= 0) return

    const row = rowStates.find((candidate) => candidate.id === rowId)
    if (!row) return

    const targetOffsetPx = row.offset + offsetPx
    const bandTopPx = scrollTopPx + WINDOW_BAND_PADDING_PX
    const bandBottomPx = scrollTopPx + viewportHeight - WINDOW_BAND_PADDING_PX

    if (targetOffsetPx >= bandTopPx && targetOffsetPx <= bandBottomPx) return

    let nextScrollTop = scrollTopPx

    if (scrollType === 'center') {
      nextScrollTop = targetOffsetPx - viewportHeight / 2
    } else if (targetOffsetPx < bandTopPx) {
      nextScrollTop = targetOffsetPx - WINDOW_BAND_PADDING_PX
    } else {
      nextScrollTop = targetOffsetPx + WINDOW_BAND_PADDING_PX - viewportHeight
    }

    nextScrollTop = clampScrollTop(nextScrollTop)
    if (nextScrollTop === scrollTopPx) return

    applyProgrammaticScrollTop(nextScrollTop)

    if (scrollType === 'center') {
      scrollAnchorMode = 'center'
    }
  }

  const scrollToRowCentered: ScrollToRowCentered = (rowId: string, offsetPx: number) => {
    if (viewportHeight <= 0) return

    const row = rowStates.find((candidate) => candidate.id === rowId)
    if (!row) return

    const targetOffsetPx = row.offset + offsetPx
    const nextScrollTop = clampScrollTop(targetOffsetPx - viewportHeight / 2)
    if (nextScrollTop === scrollTopPx) return

    applyProgrammaticScrollTop(nextScrollTop)

    scrollAnchorMode = 'center'
  }

  // Side effect: expose the scroll helper once per callback change.
  $effect(() => {
    if (!onScrollToWithinWindowBand) {
      lastScrollToWithinWindowBandCallback = null
      return
    }
    if (onScrollToWithinWindowBand === lastScrollToWithinWindowBandCallback) return
    lastScrollToWithinWindowBandCallback = onScrollToWithinWindowBand
    onScrollToWithinWindowBand(scrollToWithinWindowBand)
  })

  // Side effect: expose the centered scroll helper once per callback change.
  $effect(() => {
    if (!onScrollToRowCentered) {
      lastScrollToRowCenteredCallback = null
      return
    }
    if (onScrollToRowCentered === lastScrollToRowCenteredCallback) return
    lastScrollToRowCenteredCallback = onScrollToRowCentered
    onScrollToRowCentered(scrollToRowCentered)
  })

  // Side effect: notify consumers when the centered eligible row changes.
  $effect(() => {
    if (!onCenterRowChange) {
      lastCenterRowChangeCallback = null
      lastCenterRowId = null
      return
    }

    if (onCenterRowChange !== lastCenterRowChangeCallback) {
      lastCenterRowChangeCallback = onCenterRowChange
      lastCenterRowId = null
    }

    if (centerRowId === lastCenterRowId) return
    lastCenterRowId = centerRowId
    onCenterRowChange(centerRowData, centerRowId)
  })

  // Side effect: share viewport metrics so callers can align measurements.
  $effect(() => {
    if (!onViewportMetricsChange) {
      lastViewportMetricsCallback = null
      lastViewportMetrics = null
      return
    }

    const metrics = {
      widthPx: measurementWidth,
      heightPx: viewportHeight,
      devicePixelRatio
    }

    if (onViewportMetricsChange !== lastViewportMetricsCallback) {
      lastViewportMetricsCallback = onViewportMetricsChange
      lastViewportMetrics = null
    }

    if (
      lastViewportMetrics &&
      lastViewportMetrics.widthPx === metrics.widthPx &&
      lastViewportMetrics.heightPx === metrics.heightPx &&
      lastViewportMetrics.devicePixelRatio === metrics.devicePixelRatio
    ) {
      return
    }

    lastViewportMetrics = metrics
    onViewportMetricsChange(metrics)
  })

  // Side effect: revert to top anchoring once rendered prompt editor rows hydrate during center anchoring.
  $effect(() => {
    if (scrollAnchorMode !== 'center') return
    const hasUnhydratedVisibleRows = visibleRows.some(
      (row) =>
        getHydrationPriorityEligibility?.(row.rowData) &&
        !isRowHydrated(row)
    )
    if (!hasUnhydratedVisibleRows) {
      scrollAnchorMode = 'top'
    }
  })

  const scheduleWidthResizeIdleReset = (version: number) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (widthResizeVersion !== version) return
        widthResizeActive = false
      })
    })
  }

  const applyContainerWidth = (nextWidth: number) => {
    containerWidth = nextWidth
    if (nextWidth <= 0) return
    if (!hasInitializedWidth) {
      hasInitializedWidth = true
      previousWidthPx = nextWidth
      return
    }
    if (nextWidth === previousWidthPx) return
    previousWidthPx = nextWidth
    widthResizeActive = true
    const version = (widthResizeVersion += 1)
    scheduleWidthResizeIdleReset(version)
  }

  // Side effect: track viewport sizing and register test scroll hooks.
  onMount(() => {
    if (viewportFrame) {
      viewportHeight = viewportFrame.clientHeight
      applyContainerWidth(Math.round(viewportFrame.clientWidth))
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      viewportHeight = entry.contentRect.height
      applyContainerWidth(Math.round(entry.contentRect.width))
    })

    if (viewportFrame) {
      resizeObserver.observe(viewportFrame)
    }

    const unregisterScroller = registerTestScroller()

    return () => {
      resizeObserver.disconnect()
      unregisterScroller?.()
    }
  })

  // Capture device pixel ratio so measurements stay in sync with zoom changes.
  onMount(() => {
    const applyDevicePixelRatio = () => {
      devicePixelRatio = window.devicePixelRatio
    }

    const dprQuery = window.matchMedia('(resolution: 1dppx)')
    applyDevicePixelRatio()
    window.addEventListener('resize', applyDevicePixelRatio)
    dprQuery.addEventListener('change', applyDevicePixelRatio)

    return () => {
      window.removeEventListener('resize', applyDevicePixelRatio)
      dprQuery.removeEventListener('change', applyDevicePixelRatio)
    }
  })

  const handleWheel = (event: WheelEvent) => {
    if (viewportHeight <= 0) return
    applyUserScrollTop(scrollTopPx + event.deltaY)
  }

  // Side effect: anchor scroll position to the active anchor row when layout or viewport changes.
  $effect(() => {
    if (clampedAnchoredScrollTopPx !== scrollTopPx) {
      applyProgrammaticScrollTop(clampedAnchoredScrollTopPx)
    }

    previousRowStates = rowStates
    void viewportHeight
  })

  // Side effect: reveal the scrollbar briefly after scroll changes.
  $effect(() => {
    if (scrollTopPx === lastScrollTop) return
    lastScrollTop = scrollTopPx
    scrollbarRevealVersion += 1
  })
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
    >
      <div
        aria-hidden="true"
        data-testid={spacerTestId}
        style={`height:${totalHeightPx}px; width:1px; pointer-events:none;`}
      ></div>

      <div style="position:absolute; inset:0;">
        {#each visibleRows as row (row.id)}
          <div style={rowWrapperStyle(row)}>
            <div
              style={`width:100%; padding-left:${LEFT_SCROLL_PADDING_PX}px; padding-right:${RIGHT_SCROLL_PADDING_PX}px;`}
            >
              {@render row.snippet({
                index: row.index,
                row: row.rowData,
                rowId: row.id,
                virtualWindowWidthPx: measurementWidth,
                virtualWindowHeightPx: viewportHeight,
                devicePixelRatio,
                measuredHeightPx: row.measuredHeightPx,
                hydrationPriority: hydrationPriorityByRowId.get(row.id) ?? Number.POSITIVE_INFINITY,
                shouldDehydrate: shouldDehydrateRow(row),
                overlayRowElement: overlayRowElements.get(row.id) ?? null,
                scrollToWithinWindowBand,
                scrollToRowCentered,
                onHydrationChange: (isHydrated) => hydrationStateByRowId.set(row.id, isHydrated)
              })}
            </div>
          </div>
        {/each}
      </div>

      <div style="position:absolute; inset:0; overflow:visible; pointer-events:none;">
        {#each visibleRows as row (row.id)}
          {#if rowNeedsOverlay(row)}
            <div style={overlayRowWrapperStyle(row)}>
              <div
                use:registerOverlayRow={row.id}
                style={`width:100%; position:relative; overflow:visible; padding-left:${LEFT_SCROLL_PADDING_PX}px; padding-right:${RIGHT_SCROLL_PADDING_PX}px;`}
              ></div>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <VirtualWindowScrollbar
      scrollTopPx={scrollTopPx}
      viewportHeightPx={viewportHeight}
      totalHeightPx={totalHeightPx}
      widthPx={SCROLLBAR_WIDTH_PX}
      isPointerOverWindow={isPointerOverWindow}
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
