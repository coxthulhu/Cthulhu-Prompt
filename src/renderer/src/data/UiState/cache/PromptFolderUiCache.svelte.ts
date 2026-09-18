import type { TextMeasurement } from '@renderer/data/UiState/cache/measuredHeightCache'
import { PROMPT_FOLDER_SETTINGS_FIELDS, type PromptFolderSettingsField } from '@shared/domain/prompt-folder/PromptFolder'
import { createSessionMeasuredHeightCache } from './sessionUiCacheFactories.svelte.ts'

const settingsRowMeasuredHeight = createSessionMeasuredHeightCache()

/** Renderer-session measurements for prompt folders. */
export const promptFolderUiCache = {
  settingsRowMeasuredHeight
}

const promptFolderSettingsRowCacheId = (
  promptFolderId: string,
  field: PromptFolderSettingsField
): string => `${promptFolderId}:${field}`

export const lookupPromptFolderSettingsRowMeasuredHeight = (
  promptFolderId: string,
  field: PromptFolderSettingsField,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptFolderUiCache.settingsRowMeasuredHeight.lookup(
    promptFolderSettingsRowCacheId(promptFolderId, field),
    widthPx,
    devicePixelRatio
  )
}

export const recordPromptFolderSettingsRowMeasuredHeight = (
  promptFolderId: string,
  field: PromptFolderSettingsField,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  promptFolderUiCache.settingsRowMeasuredHeight.record(
    promptFolderSettingsRowCacheId(promptFolderId, field),
    measurement,
    textChanged
  )
}

export const clearPromptFolderSettingsFieldRowMeasuredHeight = (
  promptFolderId: string,
  field: PromptFolderSettingsField
): void => {
  promptFolderUiCache.settingsRowMeasuredHeight.clear(
    promptFolderSettingsRowCacheId(promptFolderId, field)
  )
}

export const clearPromptFolderSettingsRowMeasuredHeight = (promptFolderId: string): void => {
  for (const field of PROMPT_FOLDER_SETTINGS_FIELDS) {
    clearPromptFolderSettingsFieldRowMeasuredHeight(promptFolderId, field)
  }
}

export const clearPromptFolderSettingsRowMeasuredHeights = (promptFolderIds: string[]): void => {
  for (const promptFolderId of promptFolderIds) {
    clearPromptFolderSettingsRowMeasuredHeight(promptFolderId)
  }
}
