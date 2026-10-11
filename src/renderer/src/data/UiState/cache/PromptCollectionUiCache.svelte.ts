import type { TextMeasurement } from '@renderer/data/UiState/cache/measuredHeightCache'
import { PROMPT_COLLECTION_SETTINGS_FIELDS, type PromptCollectionSettingsField } from '@shared/domain/prompt-collection/PromptCollection'
import { createSessionMeasuredHeightCache } from './sessionUiCacheFactories.svelte.ts'

const settingsRowMeasuredHeight = createSessionMeasuredHeightCache()

/** Renderer-session measurements for prompt collections. */
export const promptCollectionUiCache = {
  settingsRowMeasuredHeight
}

const promptCollectionSettingsRowCacheId = (
  promptCollectionId: string,
  field: PromptCollectionSettingsField
): string => `${promptCollectionId}:${field}`

export const lookupPromptCollectionSettingsRowMeasuredHeight = (
  promptCollectionId: string,
  field: PromptCollectionSettingsField,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptCollectionUiCache.settingsRowMeasuredHeight.lookup(
    promptCollectionSettingsRowCacheId(promptCollectionId, field),
    widthPx,
    devicePixelRatio
  )
}

export const recordPromptCollectionSettingsRowMeasuredHeight = (
  promptCollectionId: string,
  field: PromptCollectionSettingsField,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  promptCollectionUiCache.settingsRowMeasuredHeight.record(
    promptCollectionSettingsRowCacheId(promptCollectionId, field),
    measurement,
    textChanged
  )
}

export const clearPromptCollectionSettingsFieldRowMeasuredHeight = (
  promptCollectionId: string,
  field: PromptCollectionSettingsField
): void => {
  promptCollectionUiCache.settingsRowMeasuredHeight.clear(
    promptCollectionSettingsRowCacheId(promptCollectionId, field)
  )
}

export const clearPromptCollectionSettingsRowMeasuredHeight = (promptCollectionId: string): void => {
  for (const field of PROMPT_COLLECTION_SETTINGS_FIELDS) {
    clearPromptCollectionSettingsFieldRowMeasuredHeight(promptCollectionId, field)
  }
}

export const clearPromptCollectionSettingsRowMeasuredHeights = (promptCollectionIds: string[]): void => {
  for (const promptCollectionId of promptCollectionIds) {
    clearPromptCollectionSettingsRowMeasuredHeight(promptCollectionId)
  }
}
