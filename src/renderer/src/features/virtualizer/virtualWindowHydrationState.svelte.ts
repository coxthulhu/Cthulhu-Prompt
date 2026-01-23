import { SvelteMap } from 'svelte/reactivity'

import type { VirtualWindowRowTypeRegistry } from './virtualWindowTypes'
import {
  findNearestEligibleRow,
  rowTouchesViewport
} from './virtualWindowRowUtils'
import type { VirtualRowState } from './virtualWindowRows'

type VirtualWindowHydrationStateOptions<TRow extends { kind: string }> = {
  getRowStates: () => VirtualRowState<TRow>[]
  getVisibleRows: () => VirtualRowState<TRow>[]
  getViewportRows: () => VirtualRowState<TRow>[]
  getRowRegistry: () => VirtualWindowRowTypeRegistry<TRow>
  getViewportHeight: () => number
  getClampedAnchoredScrollTopPx: () => number
  getAnchoredScrollBottomPx: () => number
  getWidthResizeActive: () => boolean
  getScrollAnchorMode: () => 'top' | 'center'
  setScrollAnchorMode: (mode: 'top' | 'center') => void
  getHydrationPriorityEligibility?: () => ((row: TRow) => boolean) | undefined
  getCenterRowEligibility?: () => ((row: TRow) => boolean) | undefined
}

export const createVirtualWindowHydrationState = <TRow extends { kind: string }>(
  options: VirtualWindowHydrationStateOptions<TRow>
) => {
  const {
    getRowStates,
    getVisibleRows,
    getViewportRows,
    getRowRegistry,
    getViewportHeight,
    getClampedAnchoredScrollTopPx,
    getAnchoredScrollBottomPx,
    getWidthResizeActive,
    getScrollAnchorMode,
    setScrollAnchorMode,
    getHydrationPriorityEligibility,
    getCenterRowEligibility
  } = options

  const hydrationStateByRowId = new SvelteMap<string, boolean>()
  const overlayRowElements = new SvelteMap<string, HTMLDivElement>()

  // Derive hydration priorities so rows closest to the viewport center hydrate first.
  const hydrationPriorityByRowId = $derived.by(() => {
    const isEligible = getHydrationPriorityEligibility?.()
    const visibleRows = getVisibleRows()
    if (!isEligible) return new SvelteMap<string, number>()
    if (visibleRows.length === 0) return new SvelteMap<string, number>()

    const viewportCenterPx = getClampedAnchoredScrollTopPx() + getViewportHeight() / 2
    const candidates = visibleRows
      .filter((row) => isEligible(row.rowData))
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
    const rowStates = getRowStates()
    const viewportHeight = getViewportHeight()
    if (rowStates.length === 0 || viewportHeight <= 0) return null
    const viewportCenterPx = getClampedAnchoredScrollTopPx() + viewportHeight / 2
    return findNearestEligibleRow(rowStates, viewportCenterPx, getCenterRowEligibility?.())
  })
  const centerRowId = $derived(centerRow?.id ?? null)
  const centerRowData = $derived(centerRow?.rowData ?? null)

  const rowNeedsOverlay = (row: VirtualRowState<TRow>): boolean =>
    getRowRegistry()[row.rowData.kind].needsOverlayRow ?? false

  const registerOverlayRow = (node: HTMLDivElement, rowId: string) => {
    overlayRowElements.set(rowId, node)
    return {
      destroy: () => {
        overlayRowElements.delete(rowId)
      }
    }
  }

  const isRowHydrated = (row: VirtualRowState<TRow> | null): boolean => {
    if (!row) return true
    if (!getHydrationPriorityEligibility?.()?.(row.rowData)) return true
    return hydrationStateByRowId.get(row.id) ?? false
  }

  const shouldDehydrateRow = (row: VirtualRowState<TRow>): boolean =>
    getWidthResizeActive() &&
    row.rowData.kind === 'prompt-editor' &&
    !rowTouchesViewport(row, getClampedAnchoredScrollTopPx(), getAnchoredScrollBottomPx())

  // Side effect: revert to top anchoring once rendered prompt editor rows hydrate during center anchoring.
  $effect(() => {
    if (getScrollAnchorMode() !== 'center') return
    const isEligible = getHydrationPriorityEligibility?.()
    const visibleRows = getViewportRows()
    const hasUnhydratedVisibleRows = visibleRows.some(
      (row) => isEligible?.(row.rowData) && !isRowHydrated(row)
    )
    if (!hasUnhydratedVisibleRows) {
      setScrollAnchorMode('top')
    }
  })

  return {
    getHydrationPriorityByRowId: () => hydrationPriorityByRowId,
    hydrationStateByRowId,
    overlayRowElements,
    registerOverlayRow,
    rowNeedsOverlay,
    shouldDehydrateRow,
    getCenterRowId: () => centerRowId,
    getCenterRowData: () => centerRowData
  }
}
