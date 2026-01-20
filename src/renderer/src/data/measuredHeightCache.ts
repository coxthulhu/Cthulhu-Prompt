import { SvelteMap } from 'svelte/reactivity'

export type TextMeasurement = {
  measuredHeightPx: number | null
  widthPx: number
  devicePixelRatio: number
}

const clampToTwoDecimalPlaces = (value: number): number => {
  return Math.round(value * 100) / 100
}

export const roundDevicePixelRatio = (value: number): number => {
  return clampToTwoDecimalPlaces(value)
}

const measurementKey = (widthPx: number, devicePixelRatio: number): string => {
  return `${widthPx}:${roundDevicePixelRatio(devicePixelRatio)}`
}

export const createMeasuredHeightCache = () => {
  const measuredHeightsById = new SvelteMap<string, SvelteMap<string, number>>()

  const lookup = (id: string, widthPx: number, devicePixelRatio: number): number | null => {
    const measurements = measuredHeightsById.get(id)
    if (!measurements) return null
    const height = measurements.get(measurementKey(widthPx, devicePixelRatio))
    return typeof height === 'number' ? height : null
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
