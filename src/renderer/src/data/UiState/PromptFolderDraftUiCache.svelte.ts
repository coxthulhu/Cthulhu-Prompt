import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import {
  createSessionMeasuredHeightCache,
  createSessionValueCache
} from './sessionUiCacheFactories.svelte.ts'

const descriptionMeasuredHeight = createSessionMeasuredHeightCache()
const scrollTop = createSessionValueCache<number>()

export const promptFolderDraftUiCache = {
  descriptionMeasuredHeight,
  scrollTop
}

export const lookupPromptFolderDescriptionMeasuredHeight = (
  promptFolderId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptFolderDraftUiCache.descriptionMeasuredHeight.lookup(
    promptFolderId,
    widthPx,
    devicePixelRatio
  )
}

export const recordPromptFolderDescriptionMeasuredHeight = (
  promptFolderId: string,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  promptFolderDraftUiCache.descriptionMeasuredHeight.record(promptFolderId, measurement, textChanged)
}

export const clearPromptFolderDescriptionMeasuredHeight = (promptFolderId: string): void => {
  promptFolderDraftUiCache.descriptionMeasuredHeight.clear(promptFolderId)
}

export const clearPromptFolderDescriptionMeasuredHeights = (promptFolderIds: string[]): void => {
  promptFolderDraftUiCache.descriptionMeasuredHeight.clearMany(promptFolderIds)
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
