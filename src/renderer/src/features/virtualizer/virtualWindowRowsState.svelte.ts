import type { VirtualWindowItem, VirtualWindowRowTypeRegistry } from './virtualWindowTypes'
import { buildRows, type VirtualRowState } from './virtualWindowRows'

type VirtualWindowRowsStateOptions<TRow extends { kind: string }> = {
  getItems: () => VirtualWindowItem<TRow>[]
  getRowRegistry: () => VirtualWindowRowTypeRegistry<TRow>
  getMeasurementWidth: () => number
  getViewportHeight: () => number
  getDevicePixelRatio: () => number
  getRowHeightGridPx: () => number
}

export const createVirtualWindowRowsState = <TRow extends { kind: string }>(
  options: VirtualWindowRowsStateOptions<TRow>
) => {
  const {
    getItems,
    getRowRegistry,
    getMeasurementWidth,
    getViewportHeight,
    getDevicePixelRatio,
    getRowHeightGridPx
  } = options

  const rowStates = $derived.by(() => {
    const measurementWidth = getMeasurementWidth()
    if (measurementWidth <= 0) return []
    return buildRows(
      getItems(),
      getRowRegistry(),
      measurementWidth,
      getViewportHeight(),
      getDevicePixelRatio(),
      getRowHeightGridPx()
    )
  })

  const totalHeightPx = $derived.by(() => rowStates.reduce((sum, row) => sum + row.height, 0))

  return {
    getRowStates: () => rowStates,
    getTotalHeightPx: () => totalHeightPx
  }
}

export type { VirtualRowState }
