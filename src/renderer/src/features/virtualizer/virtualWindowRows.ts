import type {
  VirtualWindowItem,
  VirtualWindowRowSnippet,
  VirtualWindowRowTypeRegistry
} from './virtualWindowTypes'

export type VirtualRowState<TRow extends { kind: string }> = {
  id: string
  index: number
  offset: number
  offsetDevicePx: number
  height: number
  heightDevicePx: number
  measuredHeightPx: number | null
  rowData: TRow
  snippet: VirtualWindowRowSnippet<TRow>
}

export const normalizeDevicePixelRatio = (dpr: number): number => {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1
  return dpr
}

const resolveRowHeightCssPx = (estimated: number, measured: number | null): number => {
  if (measured != null && Number.isFinite(measured)) {
    return measured
  }
  if (!Number.isFinite(estimated)) return 0
  return estimated
}

const toDevicePixelHeight = (heightCssPx: number, dpr: number): number => {
  if (heightCssPx <= 0) return 0
  return Math.ceil(heightCssPx * dpr)
}

// Build row state with estimated and measured heights merged.
export const buildRows = <TRow extends { kind: string }>(
  nextItems: VirtualWindowItem<TRow>[],
  registry: VirtualWindowRowTypeRegistry<TRow>,
  width: number,
  viewportHeightPx: number,
  dpr: number
): VirtualRowState<TRow>[] => {
  const rows: VirtualRowState<TRow>[] = []
  const safeDpr = normalizeDevicePixelRatio(dpr)
  let offsetDevicePx = 0

  nextItems.forEach((item, index) => {
    const entry = registry[item.row.kind]
    const estimatedHeight = entry.estimateHeight(item.row, width, viewportHeightPx)
    const measuredHeightPx = entry.lookupMeasuredHeight?.(item.row, width, safeDpr) ?? null
    const resolvedHeightCssPx = resolveRowHeightCssPx(estimatedHeight, measuredHeightPx)
    const heightDevicePx = toDevicePixelHeight(resolvedHeightCssPx, safeDpr)
    const offset = offsetDevicePx / safeDpr
    const height = heightDevicePx / safeDpr

    rows.push({
      id: item.id,
      index,
      offset,
      offsetDevicePx,
      height,
      heightDevicePx,
      measuredHeightPx,
      rowData: item.row,
      snippet: entry.snippet
    })

    offsetDevicePx += heightDevicePx
  })

  return rows
}
