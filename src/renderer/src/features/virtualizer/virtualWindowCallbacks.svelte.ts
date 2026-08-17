import type { VirtualWindowViewportMetrics } from './virtualWindowTypes'

type VirtualWindowCallbacksOptions<TRow extends { kind: string }> = {
  getOnCenterRowChange: () => ((row: TRow | null, rowId: string | null) => void) | undefined
  getCenterRowId: () => string | null
  getCenterRowData: () => TRow | null
  /** Returns the consumer notified when the configured sample point enters another row. */
  getOnSampleRowChange: () => ((row: TRow | null, rowId: string | null) => void) | undefined
  /** Returns the virtual-row ID currently containing the configured sample point. */
  getSampleRowId: () => string | null
  /** Returns the row data currently containing the configured sample point. */
  getSampleRowData: () => TRow | null
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
    getOnSampleRowChange,
    getSampleRowId,
    getSampleRowData,
    setViewportMetrics,
    getMeasurementWidth,
    getViewportHeight,
    getDevicePixelRatio
  } = options

  let lastCenterRowChangeCallback: ((row: TRow | null, rowId: string | null) => void) | null = null
  let lastCenterRowId: string | null = null
  /** Last sample callback used to ensure a newly supplied consumer receives the current row. */
  let lastSampleRowChangeCallback: ((row: TRow | null, rowId: string | null) => void) | null = null
  /** Last reported sample-row ID used to suppress duplicate notifications. */
  let lastSampleRowId: string | null = null
  /** Last reported sample-row data used to detect ownership changes within a stable row ID. */
  let lastSampleRowData: TRow | null = null
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

  // Side effect: notify consumers when the configured sample point enters another row.
  $effect(() => {
    /** Current optional consumer for sampled-row changes. */
    const onSampleRowChange = getOnSampleRowChange()
    if (!onSampleRowChange) {
      lastSampleRowChangeCallback = null
      lastSampleRowId = null
      lastSampleRowData = null
      return
    }

    if (onSampleRowChange !== lastSampleRowChangeCallback) {
      lastSampleRowChangeCallback = onSampleRowChange
      lastSampleRowId = null
      lastSampleRowData = null
    }

    /** Current stable identity at the sample point. */
    const sampleRowId = getSampleRowId()
    /** Current row data at the sample point. */
    const sampleRowData = getSampleRowData()
    if (sampleRowId === lastSampleRowId && sampleRowData === lastSampleRowData) return
    lastSampleRowId = sampleRowId
    lastSampleRowData = sampleRowData
    onSampleRowChange(sampleRowData, sampleRowId)
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
