import { createMeasuredHeightCache, type TextMeasurement } from '@renderer/data/measuredHeightCache'
import { SvelteMap } from 'svelte/reactivity'

export type SessionMeasuredHeightCache = {
  lookup: (id: string, widthPx: number, devicePixelRatio: number) => number | null
  record: (id: string, measurement: TextMeasurement, textChanged: boolean) => void
  clear: (id: string) => void
  clearMany: (ids: string[]) => void
  clearAll: () => void
}

export const createSessionMeasuredHeightCache = (): SessionMeasuredHeightCache => {
  const cache = createMeasuredHeightCache()

  return {
    lookup: (id, widthPx, devicePixelRatio) => cache.lookup(id, widthPx, devicePixelRatio),
    record: (id, measurement, textChanged) => cache.record(id, measurement, textChanged),
    clear: (id) => cache.clear(id),
    clearMany: (ids) => {
      for (const id of ids) {
        cache.clear(id)
      }
    },
    clearAll: () => cache.clearAll()
  }
}

export type SessionValueCache<TValue> = {
  lookup: (id: string) => TValue | null
  record: (id: string, value: TValue) => void
  clear: (id: string) => void
  clearMany: (ids: string[]) => void
  clearAll: () => void
}

export const createSessionValueCache = <TValue>(): SessionValueCache<TValue> => {
  const valuesById = new SvelteMap<string, TValue>()

  return {
    lookup: (id) => valuesById.get(id) ?? null,
    record: (id, value) => {
      valuesById.set(id, value)
    },
    clear: (id) => {
      valuesById.delete(id)
    },
    clearMany: (ids) => {
      for (const id of ids) {
        valuesById.delete(id)
      }
    },
    clearAll: () => {
      valuesById.clear()
    }
  }
}
