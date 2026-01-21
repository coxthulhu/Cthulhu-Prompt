import type { VirtualRowState } from './virtualWindowRows'
import { snapToDevicePixels } from './virtualWindowRowUtils'

// Style strings are derived from row offsets and anchored scroll position.
export const rowWrapperStyle = <TRow extends { kind: string }>(
  row: VirtualRowState<TRow>,
  scrollTopPx: number,
  dpr: number
): string => {
  const translateY = snapToDevicePixels(row.offset - scrollTopPx, dpr)
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

export const overlayRowWrapperStyle = <TRow extends { kind: string }>(
  row: VirtualRowState<TRow>,
  scrollTopPx: number,
  dpr: number
): string => {
  const translateY = snapToDevicePixels(row.offset - scrollTopPx, dpr)
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
