import { SvelteMap } from 'svelte/reactivity'

export type TextMeasurement = {
  measuredHeightPx: number | null
  widthPx: number
  devicePixelRatio: number
}

const measurementKey = (widthPx: number, devicePixelRatio: number): string => {
  const roundedDevicePixelRatio = Math.round(devicePixelRatio * 100) / 100
  return `${widthPx}:${roundedDevicePixelRatio}`
}

export const createMeasuredHeightCache = () => {
  const measuredHeightsById = new SvelteMap<string, SvelteMap<string, number>>()

  const lookup = (id: string, widthPx: number, devicePixelRatio: number): number | null => {
    const measurements = measuredHeightsById.get(id)
    if (!measurements) return null
    return measurements.get(measurementKey(widthPx, devicePixelRatio)) ?? null
  }

  const record = (id: string, measurement: TextMeasurement, textChanged: boolean): void => {
    const key = measurementKey(measurement.widthPx, measurement.devicePixelRatio)
    if (textChanged) {
      if (measurement.measuredHeightPx == null) {
        measuredHeightsById.delete(id)
        return
      }
      const nextMeasurements = new SvelteMap<string, number>()
      nextMeasurements.set(key, measurement.measuredHeightPx)
      measuredHeightsById.set(id, nextMeasurements)
      return
    }

    if (measurement.measuredHeightPx == null) return

    const measurements = measuredHeightsById.get(id) ?? new SvelteMap<string, number>()
    measurements.set(key, measurement.measuredHeightPx)
    measuredHeightsById.set(id, measurements)
  }

  const clear = (id: string): void => {
    measuredHeightsById.delete(id)
  }

  const clearAll = (): void => {
    measuredHeightsById.clear()
  }

  return {
    lookup,
    record,
    clear,
    clearAll
  }
}
