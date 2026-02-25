import { createMeasuredHeightCache, type TextMeasurement } from '@renderer/data/measuredHeightCache'
import { SvelteMap } from 'svelte/reactivity'

const promptEditorMeasuredHeightCache = createMeasuredHeightCache()
const promptFolderDescriptionMeasuredHeightCache = createMeasuredHeightCache()
const promptFolderScrollTopById = new SvelteMap<string, number>()

export const lookupPromptEditorMeasuredHeight = (
  promptId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptEditorMeasuredHeightCache.lookup(promptId, widthPx, devicePixelRatio)
}

export const recordPromptEditorMeasuredHeight = (
  promptId: string,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  promptEditorMeasuredHeightCache.record(promptId, measurement, textChanged)
}

export const clearPromptEditorMeasuredHeight = (promptId: string): void => {
  promptEditorMeasuredHeightCache.clear(promptId)
}

export const clearPromptEditorMeasuredHeights = (promptIds: string[]): void => {
  for (const promptId of promptIds) {
    promptEditorMeasuredHeightCache.clear(promptId)
  }
}

export const lookupPromptFolderDescriptionMeasuredHeight = (
  promptFolderId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptFolderDescriptionMeasuredHeightCache.lookup(
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
  promptFolderDescriptionMeasuredHeightCache.record(promptFolderId, measurement, textChanged)
}

export const clearPromptFolderDescriptionMeasuredHeight = (promptFolderId: string): void => {
  promptFolderDescriptionMeasuredHeightCache.clear(promptFolderId)
}

export const clearPromptFolderDescriptionMeasuredHeights = (promptFolderIds: string[]): void => {
  for (const promptFolderId of promptFolderIds) {
    promptFolderDescriptionMeasuredHeightCache.clear(promptFolderId)
  }
}

export const lookupPromptFolderScrollTop = (promptFolderId: string): number | null => {
  return promptFolderScrollTopById.get(promptFolderId) ?? null
}

export const recordPromptFolderScrollTop = (promptFolderId: string, scrollTopPx: number): void => {
  promptFolderScrollTopById.set(promptFolderId, scrollTopPx)
}

export const clearPromptFolderScrollTop = (promptFolderId: string): void => {
  promptFolderScrollTopById.delete(promptFolderId)
}

export const clearPromptFolderScrollTops = (promptFolderIds: string[]): void => {
  for (const promptFolderId of promptFolderIds) {
    promptFolderScrollTopById.delete(promptFolderId)
  }
}
