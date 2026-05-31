import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
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

export const lookupPromptFolderSettingsRowMeasuredHeight = (
  promptFolderId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptFolderDraftUiCache.settingsRowMeasuredHeight.lookup(
    promptFolderId,
    widthPx,
    devicePixelRatio
  )
}

export const recordPromptFolderSettingsRowMeasuredHeight = (
  promptFolderId: string,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  promptFolderDraftUiCache.settingsRowMeasuredHeight.record(
    promptFolderId,
    measurement,
    textChanged
  )
}

export const clearPromptFolderSettingsRowMeasuredHeight = (promptFolderId: string): void => {
  promptFolderDraftUiCache.settingsRowMeasuredHeight.clear(promptFolderId)
}

export const clearPromptFolderSettingsRowMeasuredHeights = (promptFolderIds: string[]): void => {
  promptFolderDraftUiCache.settingsRowMeasuredHeight.clearMany(promptFolderIds)
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
