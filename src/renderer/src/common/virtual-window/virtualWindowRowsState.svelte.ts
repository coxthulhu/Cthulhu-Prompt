import type { VirtualWindowItem, VirtualWindowRowTypeRegistry } from './virtualWindowTypes'
import { buildRows, normalizeDevicePixelRatio, type VirtualRowState, type VirtualWindowResizeAnchor } from './virtualWindowRows'

type VirtualWindowRowsStateOptions<TRow extends { kind: string }> = {
  getItems: () => VirtualWindowItem<TRow>[]
  getRowRegistry: () => VirtualWindowRowTypeRegistry<TRow>
  getMeasurementWidth: () => number
  getViewportHeight: () => number
  getDevicePixelRatio: () => number
  /** Supplies the previous height of the row anchored during a width change. */
  getResizeAnchor: () => VirtualWindowResizeAnchor | null
}

export const createVirtualWindowRowsState = <TRow extends { kind: string }>(
  options: VirtualWindowRowsStateOptions<TRow>
) => {
  const { getItems, getRowRegistry, getMeasurementWidth, getViewportHeight, getDevicePixelRatio } =
    options

  const rowStates = $derived.by(() => {
    const measurementWidth = getMeasurementWidth()
    if (measurementWidth <= 0) return []
    return buildRows(
      getItems(),
      getRowRegistry(),
      measurementWidth,
      getViewportHeight(),
      getDevicePixelRatio(),
      options.getResizeAnchor()
    )
  })

  const totalHeightPx = $derived.by(() => {
    const dpr = normalizeDevicePixelRatio(getDevicePixelRatio())
    const totalHeightDevicePx = rowStates.reduce((sum, row) => sum + row.heightDevicePx, 0)
    return totalHeightDevicePx / dpr
  })

  return {
    getRowStates: () => rowStates,
    getTotalHeightPx: () => totalHeightPx
  }
}

export type { VirtualRowState }
