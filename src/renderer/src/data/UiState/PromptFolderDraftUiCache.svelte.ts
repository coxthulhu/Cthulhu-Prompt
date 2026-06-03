import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  type PromptFolderSettingsField
} from '@shared/PromptFolder'
import {
  createSessionMeasuredHeightCache,
  createSessionValueCache
} from './sessionUiCacheFactories.svelte.ts'

const settingsRowMeasuredHeight = createSessionMeasuredHeightCache()
const scrollTop = createSessionValueCache<number>()

export const promptFolderDraftUiCache = {
  settingsRowMeasuredHeight,
  scrollTop
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
  return promptFolderDraftUiCache.settingsRowMeasuredHeight.lookup(
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
  promptFolderDraftUiCache.settingsRowMeasuredHeight.record(
    promptFolderSettingsRowCacheId(promptFolderId, field),
    measurement,
    textChanged
  )
}

export const clearPromptFolderSettingsRowMeasuredHeight = (promptFolderId: string): void => {
  for (const field of PROMPT_FOLDER_SETTINGS_FIELDS) {
    promptFolderDraftUiCache.settingsRowMeasuredHeight.clear(
      promptFolderSettingsRowCacheId(promptFolderId, field)
    )
  }
}

export const clearPromptFolderSettingsRowMeasuredHeights = (promptFolderIds: string[]): void => {
  for (const promptFolderId of promptFolderIds) {
    clearPromptFolderSettingsRowMeasuredHeight(promptFolderId)
  }
}

export const lookupPromptFolderScrollTop = (promptFolderId: string): number | null => {
  return promptFolderDraftUiCache.scrollTop.lookup(promptFolderId)
}

export const recordPromptFolderScrollTop = (promptFolderId: string, scrollTopPx: number): void => {
  promptFolderDraftUiCache.scrollTop.record(promptFolderId, scrollTopPx)
}

export const clearPromptFolderScrollTop = (promptFolderId: string): void => {
  promptFolderDraftUiCache.scrollTop.clear(promptFolderId)
}

export const clearPromptFolderScrollTops = (promptFolderIds: string[]): void => {
  promptFolderDraftUiCache.scrollTop.clearMany(promptFolderIds)
}
