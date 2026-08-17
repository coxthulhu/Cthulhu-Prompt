import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { createSessionMeasuredHeightCache } from './sessionUiCacheFactories.svelte.ts'

/** Session-only measured heights for category description editors. */
const categoryDescriptionMeasuredHeight = createSessionMeasuredHeightCache()

/** Looks up a measured category description height for the current viewport geometry. */
export const lookupCategoryDescriptionMeasuredHeight = (
  categoryId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null =>
  categoryDescriptionMeasuredHeight.lookup(categoryId, widthPx, devicePixelRatio)

/** Records the latest measured category description height. */
export const recordCategoryDescriptionMeasuredHeight = (
  categoryId: string,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  categoryDescriptionMeasuredHeight.record(categoryId, measurement, textChanged)
}

/** Clears the measured height cached for one category description. */
export const clearCategoryDescriptionMeasuredHeight = (categoryId: string): void => {
  categoryDescriptionMeasuredHeight.clear(categoryId)
}
