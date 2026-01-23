import type { VirtualRowState } from './virtualWindowRows'

// Row traversal helpers for SvelteVirtualWindow.
export const findIndexAtOffset = <TRow extends { kind: string }>(
  rows: readonly VirtualRowState<TRow>[],
  offset: number
): number => {
  if (rows.length === 0) return -1

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const end = row.offset + row.height
    if (offset < end) return i
  }

  return rows.length - 1
}

export const computeAnchoredScrollTop = <TRow extends { kind: string }>(
  previousRows: readonly VirtualRowState<TRow>[],
  nextRows: readonly VirtualRowState<TRow>[],
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

export const findNearestEligibleRow = <TRow extends { kind: string }>(
  rows: readonly VirtualRowState<TRow>[],
  centerPx: number,
  isEligible?: (row: TRow) => boolean
): VirtualRowState<TRow> | null => {
  if (rows.length === 0) return null

  let candidate: VirtualRowState<TRow> | null = null
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

export const rowTouchesViewport = <TRow extends { kind: string }>(
  row: VirtualRowState<TRow>,
  viewportTopPx: number,
  viewportBottomPx: number
): boolean => row.offset + row.height >= viewportTopPx && row.offset <= viewportBottomPx

export const snapToDevicePixels = (value: number, dpr: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(dpr) || dpr <= 0) return value
  return Math.round(value * dpr) / dpr
}
