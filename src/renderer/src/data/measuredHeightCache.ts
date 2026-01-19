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
    let measurements = measuredHeightsById.get(id)
    if (!measurements && measurement.measuredHeightPx != null) {
      measurements = new SvelteMap()
      measuredHeightsById.set(id, measurements)
    }

    if (!measurements) return

    if (textChanged) {
      for (const existingKey of measurements.keys()) {
        if (existingKey !== key) {
          measurements.delete(existingKey)
        }
      }
    }

    if (measurement.measuredHeightPx != null) {
      measurements.set(key, measurement.measuredHeightPx)
    }
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
