import type { VirtualWindowViewportMetrics } from './virtualWindowTypes'

type VirtualWindowCallbacksOptions<TRow extends { kind: string }> = {
  getOnCenterRowChange: () => ((row: TRow | null, rowId: string | null) => void) | undefined
  getCenterRowId: () => string | null
  getCenterRowData: () => TRow | null
  setViewportMetrics: (metrics: VirtualWindowViewportMetrics) => void
  getMeasurementWidth: () => number
  getViewportHeight: () => number
  getDevicePixelRatio: () => number
}

export const useVirtualWindowCallbacks = <TRow extends { kind: string }>(
  options: VirtualWindowCallbacksOptions<TRow>
) => {
  const {
    getOnCenterRowChange,
    getCenterRowId,
    getCenterRowData,
    setViewportMetrics,
    getMeasurementWidth,
    getViewportHeight,
    getDevicePixelRatio
  } = options

  let lastCenterRowChangeCallback: ((row: TRow | null, rowId: string | null) => void) | null = null
  let lastCenterRowId: string | null = null
  let lastViewportMetrics: VirtualWindowViewportMetrics | null = null

  // Side effect: notify consumers when the centered eligible row changes.
  $effect(() => {
    const onCenterRowChange = getOnCenterRowChange()
    if (!onCenterRowChange) {
      lastCenterRowChangeCallback = null
      lastCenterRowId = null
      return
    }

    if (onCenterRowChange !== lastCenterRowChangeCallback) {
      lastCenterRowChangeCallback = onCenterRowChange
      lastCenterRowId = null
    }

    const centerRowId = getCenterRowId()
    if (centerRowId === lastCenterRowId) return
    lastCenterRowId = centerRowId
    onCenterRowChange(getCenterRowData(), centerRowId)
  })

  // Side effect: keep the bound viewport metrics in sync.
  $effect(() => {
    const metrics: VirtualWindowViewportMetrics = {
      widthPx: getMeasurementWidth(),
      heightPx: getViewportHeight(),
      devicePixelRatio: getDevicePixelRatio()
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
    setViewportMetrics(metrics)
  })
}
