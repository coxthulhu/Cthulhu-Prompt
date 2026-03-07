import type {
  VirtualWindowItem,
  VirtualWindowRowSnippet,
  VirtualWindowRowTypeRegistry
} from './virtualWindowTypes'

export type VirtualRowState<TRow extends { kind: string }> = {
  id: string
  index: number
  offset: number
  height: number
  measuredHeightPx: number | null
  rowData: TRow
  snippet: VirtualWindowRowSnippet<TRow>
}

const DEFAULT_ROW_HEIGHT_GRID_PX = 4
const normalizeRowHeight = (height: number, rowHeightGridPx: number): number => {
  if (height <= 0) return 0
  const gridPx = rowHeightGridPx > 0 ? rowHeightGridPx : DEFAULT_ROW_HEIGHT_GRID_PX
  return Math.ceil(height / gridPx) * gridPx
}

const resolveRowHeight = (
  estimated: number,
  measured: number | null,
  rowHeightGridPx: number
): number => {
  if (measured != null && Number.isFinite(measured)) {
    return normalizeRowHeight(measured, rowHeightGridPx)
  }
  return normalizeRowHeight(estimated, rowHeightGridPx)
}

// Build row state with estimated and measured heights merged.
export const buildRows = <TRow extends { kind: string }>(
  nextItems: VirtualWindowItem<TRow>[],
  registry: VirtualWindowRowTypeRegistry<TRow>,
  width: number,
  viewportHeightPx: number,
  dpr: number,
  rowHeightGridPx: number = DEFAULT_ROW_HEIGHT_GRID_PX
): VirtualRowState<TRow>[] => {
  const rows: VirtualRowState<TRow>[] = []
  let offset = 0

  nextItems.forEach((item, index) => {
    const entry = registry[item.row.kind]
    const estimatedHeight = entry.estimateHeight(item.row, width, viewportHeightPx)
    const measuredHeightPx = entry.lookupMeasuredHeight?.(item.row, width, dpr) ?? null
    const height = resolveRowHeight(estimatedHeight, measuredHeightPx, rowHeightGridPx)

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
