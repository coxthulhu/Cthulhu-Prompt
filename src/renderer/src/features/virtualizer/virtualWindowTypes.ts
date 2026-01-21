import type { Snippet } from 'svelte'

export type VirtualWindowItem<TRow extends { kind: string }> = {
  id: string
  row: TRow
}

export type VirtualWindowRowComponentProps<TRow> = {
  index: number
  row: TRow
  rowId: string
  virtualWindowWidthPx: number
  virtualWindowHeightPx: number
  devicePixelRatio: number
  measuredHeightPx: number | null
  hydrationPriority: number
  shouldDehydrate: boolean
  overlayRowElement?: HTMLDivElement | null
  scrollToWithinWindowBand?: ScrollToWithinWindowBand
  scrollToRowCentered?: ScrollToRowCentered
  onHydrationChange?: (isHydrated: boolean) => void
}

export type VirtualWindowRowSnippet<TRow> = Snippet<[VirtualWindowRowComponentProps<TRow>]>

export type ScrollToWithinWindowBandType = 'center' | 'minimal'

export type ScrollToWithinWindowBand = (
  rowId: string,
  offsetPx: number,
  scrollType: ScrollToWithinWindowBandType
) => void

export type ScrollToRowCentered = (rowId: string, offsetPx: number) => void

export type VirtualWindowScrollApi = {
  scrollTo: (scrollTopPx: number) => void
  getScrollTop: () => number
}

export type VirtualWindowRowTypeRegistryEntry<TRow> = {
  estimateHeight: (row: TRow, widthPx: number, heightPx: number) => number
  lookupMeasuredHeight?: (row: TRow, widthPx: number, devicePixelRatio: number) => number | null
  snippet: VirtualWindowRowSnippet<TRow>
  needsOverlayRow?: boolean
}

export type VirtualWindowRowTypeRegistry<TRow extends { kind: string }> = {
  readonly [K in TRow['kind']]: VirtualWindowRowTypeRegistryEntry<Extract<TRow, { kind: K }>>
}

type DiscriminatedRowTypeRegistry<TRow extends { kind: string }> = string extends TRow['kind']
  ? never
  : VirtualWindowRowTypeRegistry<TRow>

// Enforces that row kinds are a string-literal union, so every kind must define an estimate/snippet.
export const defineVirtualWindowRowRegistry = <TRow extends { kind: string }>(
  registry: DiscriminatedRowTypeRegistry<TRow>
): VirtualWindowRowTypeRegistry<TRow> => {
  return registry
}
