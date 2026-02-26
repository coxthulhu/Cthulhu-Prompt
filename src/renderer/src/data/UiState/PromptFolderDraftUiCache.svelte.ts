import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import {
  createSessionMeasuredHeightCache,
  createSessionValueCache
} from './sessionUiCacheFactories.svelte.ts'

export type PromptFolderOutlinerActiveRow =
  | { kind: 'folder-settings' }
  | { kind: 'prompt'; promptId: string }

const descriptionMeasuredHeight = createSessionMeasuredHeightCache()
const scrollTop = createSessionValueCache<number>()
const outlinerScrollTop = createSessionValueCache<number>()
const outlinerActiveRow = createSessionValueCache<PromptFolderOutlinerActiveRow | null>()

export const promptFolderDraftUiCache = {
  descriptionMeasuredHeight,
  scrollTop,
  outlinerScrollTop,
  outlinerActiveRow
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

export const lookupPromptFolderOutlinerScrollTop = (promptFolderId: string): number | null => {
  return promptFolderDraftUiCache.outlinerScrollTop.lookup(promptFolderId)
}

export const recordPromptFolderOutlinerScrollTop = (
  promptFolderId: string,
  scrollTopPx: number
): void => {
  promptFolderDraftUiCache.outlinerScrollTop.record(promptFolderId, scrollTopPx)
}

export const lookupPromptFolderOutlinerActiveRow = (
  promptFolderId: string
): PromptFolderOutlinerActiveRow | null => {
  return promptFolderDraftUiCache.outlinerActiveRow.lookup(promptFolderId)
}

export const recordPromptFolderOutlinerActiveRow = (
  promptFolderId: string,
  row: PromptFolderOutlinerActiveRow | null
): void => {
  promptFolderDraftUiCache.outlinerActiveRow.record(promptFolderId, row)
}

export const clearPromptFolderScrollTop = (promptFolderId: string): void => {
  promptFolderDraftUiCache.scrollTop.clear(promptFolderId)
  promptFolderDraftUiCache.outlinerScrollTop.clear(promptFolderId)
  promptFolderDraftUiCache.outlinerActiveRow.clear(promptFolderId)
}

export const clearPromptFolderScrollTops = (promptFolderIds: string[]): void => {
  promptFolderDraftUiCache.scrollTop.clearMany(promptFolderIds)
  promptFolderDraftUiCache.outlinerScrollTop.clearMany(promptFolderIds)
  promptFolderDraftUiCache.outlinerActiveRow.clearMany(promptFolderIds)
}
