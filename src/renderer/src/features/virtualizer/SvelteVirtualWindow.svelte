<script lang="ts" generics="TRow extends { kind: string }">
  import { onMount } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import {
    type VirtualWindowItem,
    type VirtualWindowRowSnippet,
    type VirtualWindowRowTypeRegistry
  } from './virtualWindowTypes'

  type VirtualWindowProps = {
    items: VirtualWindowItem<TRow>[]
    rowRegistry: VirtualWindowRowTypeRegistry<TRow>
    getHydrationPriorityEligibility?: (row: TRow) => boolean
  }

  // Generic over row shape; callers provide the concrete discriminated union.
  let { items, rowRegistry, getHydrationPriorityEligibility }: VirtualWindowProps = $props()

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

  let scrollContainer: HTMLDivElement | null = null

  let containerWidth = $state(0)
  let devicePixelRatio = $state(1)
  let hasInitializedWidth = false
  let previousWidthPx = 0
  let widthResizeActive = $state(false)
  let widthResizeVersion = 0

  const LEFT_SCROLL_PADDING_PX = 24
  const RIGHT_SCROLL_PADDING_PX = 8

  // Subtract internal padding so width-based height measurements match the row content width.
  const measurementWidth = $derived(
    Math.max(0, containerWidth - LEFT_SCROLL_PADDING_PX - RIGHT_SCROLL_PADDING_PX)
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
    scrollTop: number
  ): number => {
    const anchorRow = previousRows[findIndexAtOffset(previousRows, scrollTop)]
    if (!anchorRow) return scrollTop
    const offsetInRow = scrollTop - anchorRow.offset
    const nextRow = nextRows.find((row) => row.id === anchorRow.id)
    return nextRow ? nextRow.offset + offsetInRow : scrollTop
  }

  const resolveRowHeight = (estimated: number, measured: number | null): number => {
    if (measured != null && Number.isFinite(measured)) return measured
    return estimated
  }

  const normalizeEstimatedHeight = (estimatedHeight: number): number => {
    if (estimatedHeight <= 0) return 0
    return Math.ceil(estimatedHeight / 4) * 4
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

  const rowStates = $derived.by(() => {
    if (measurementWidth <= 0) return []
    return buildRows(items, rowRegistry, measurementWidth, viewportHeight, devicePixelRatio)
  })
  const rowHeightsPx = $derived(rowStates.map((row) => row.height))
  const totalHeightPx = $derived(
    rowHeightsPx.length === 0 ? 0 : rowHeightsPx.reduce((sum, height) => sum + height, 0)
  )

  let scrollTopPx = $state(0)
  let viewportHeight = $state(0)
  let previousRowStates = $state<RowState[]>([])

  // Anchor viewport math to the scroll position we will apply after layout changes.
  const anchoredScrollTopPx = $derived.by(() =>
    computeAnchoredScrollTop(previousRowStates, rowStates, scrollTopPx)
  )
  const anchoredScrollBottomPx = $derived(anchoredScrollTopPx + viewportHeight)

  const OVERSCAN_PX = 1000

  // Overscan the viewport so rows above/below are rendered ahead of scroll.
  const overscannedTopPx = $derived(Math.max(0, anchoredScrollTopPx - OVERSCAN_PX))
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

    const viewportCenterPx = anchoredScrollTopPx + viewportHeight / 2
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

  const rowWrapperStyle = (row: RowState): string =>
    [
      'position:absolute',
      'top:0',
      'left:0',
      'width:100%',
      `transform:translate3d(0, ${row.offset}px, 0)`,
      'contain:layout paint style',
      `height:${row.height}px`,
      `min-height:${row.height}px`,
      `max-height:${row.height}px`
    ].join(';')

  const rowTouchesViewport = (row: RowState): boolean =>
    row.offset + row.height >= anchoredScrollTopPx && row.offset <= anchoredScrollBottomPx

  const shouldDehydrateRow = (row: RowState): boolean =>
    widthResizeActive && row.rowData.kind === 'prompt-editor' && !rowTouchesViewport(row)

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

  // Track scroll host size so virtualization math stays aligned with the viewport and width.
  onMount(() => {
    if (scrollContainer) {
      viewportHeight = scrollContainer.clientHeight
      scrollTopPx = scrollContainer.scrollTop
      applyContainerWidth(Math.round(scrollContainer.clientWidth))
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      viewportHeight = entry.contentRect.height
      applyContainerWidth(Math.round(entry.contentRect.width))
    })

    if (scrollContainer) {
      resizeObserver.observe(scrollContainer)
    }

    return () => {
      resizeObserver.disconnect()
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

  const handleScroll = (event: Event) => {
    const target = event.currentTarget as HTMLDivElement
    scrollTopPx = target.scrollTop
  }

  // Side effect: anchor scroll position to the top-intersecting row when layout or viewport changes.
  $effect(() => {
    if (scrollContainer && anchoredScrollTopPx !== scrollTopPx) {
      scrollContainer.scrollTop = anchoredScrollTopPx
      scrollTopPx = anchoredScrollTopPx
    }

    previousRowStates = rowStates
    void viewportHeight
  })
</script>

<div
  bind:this={scrollContainer}
  class="h-full w-full"
  style="overflow-anchor: none; overflow-y: scroll; overflow-x: hidden; position: relative;"
  data-testid="virtual-window"
  onscroll={handleScroll}
>
  <div
    aria-hidden="true"
    data-testid="virtual-window-spacer"
    style={`height:${totalHeightPx}px; width:1px; pointer-events:none;`}
  ></div>

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
          shouldDehydrate: shouldDehydrateRow(row)
        })}
      </div>
    </div>
  {/each}
</div>
