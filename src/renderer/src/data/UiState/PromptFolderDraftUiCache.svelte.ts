import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import {
  createSessionMeasuredHeightCache,
  createSessionValueCache
} from './sessionUiCacheFactories.svelte.ts'

export type PromptFolderPromptTreeActiveRow =
  | { kind: 'folder-settings' }
  | { kind: 'prompt'; promptId: string }

export type PromptTreeJumpTarget =
  | { kind: 'folder-settings' }
  | { kind: 'prompt'; promptId: string }

export type PromptTreeJumpRequest = {
  requestId: number
  mode: 'initial' | 'immediate'
  target: PromptTreeJumpTarget
}

const descriptionMeasuredHeight = createSessionMeasuredHeightCache()
const scrollTop = createSessionValueCache<number>()
const promptTreeActiveRow = createSessionValueCache<PromptFolderPromptTreeActiveRow | null>()
const promptTreeJumpRequest = createSessionValueCache<PromptTreeJumpRequest>()

export const promptFolderDraftUiCache = {
  descriptionMeasuredHeight,
  scrollTop,
  promptTreeActiveRow,
  promptTreeJumpRequest
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

export const lookupPromptFolderPromptTreeActiveRow = (
  promptFolderId: string
): PromptFolderPromptTreeActiveRow | null => {
  return promptFolderDraftUiCache.promptTreeActiveRow.lookup(promptFolderId)
}

export const recordPromptFolderPromptTreeActiveRow = (
  promptFolderId: string,
  row: PromptFolderPromptTreeActiveRow | null
): void => {
  promptFolderDraftUiCache.promptTreeActiveRow.record(promptFolderId, row)
}

export const lookupPromptTreeJumpRequest = (promptFolderId: string): PromptTreeJumpRequest | null => {
  return promptFolderDraftUiCache.promptTreeJumpRequest.lookup(promptFolderId)
}

export const recordPromptTreeJumpRequest = (
  promptFolderId: string,
  request: PromptTreeJumpRequest
): void => {
  promptFolderDraftUiCache.promptTreeJumpRequest.record(promptFolderId, request)
}

export const clearPromptTreeJumpRequest = (promptFolderId: string): void => {
  promptFolderDraftUiCache.promptTreeJumpRequest.clear(promptFolderId)
}

export const clearPromptFolderScrollTop = (promptFolderId: string): void => {
  promptFolderDraftUiCache.scrollTop.clear(promptFolderId)
  promptFolderDraftUiCache.promptTreeActiveRow.clear(promptFolderId)
  promptFolderDraftUiCache.promptTreeJumpRequest.clear(promptFolderId)
}

export const clearPromptFolderScrollTops = (promptFolderIds: string[]): void => {
  promptFolderDraftUiCache.scrollTop.clearMany(promptFolderIds)
  promptFolderDraftUiCache.promptTreeActiveRow.clearMany(promptFolderIds)
  promptFolderDraftUiCache.promptTreeJumpRequest.clearMany(promptFolderIds)
}
