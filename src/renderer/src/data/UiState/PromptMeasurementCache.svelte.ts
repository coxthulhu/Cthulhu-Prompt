import {
  createMeasuredHeightCache,
  type TextMeasurement
} from '@renderer/data/measuredHeightCache'

const promptEditorMeasuredHeightCache = createMeasuredHeightCache()
const promptFolderDescriptionMeasuredHeightCache = createMeasuredHeightCache()

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

export const clearPromptFolderDescriptionMeasuredHeight = (
  promptFolderId: string
): void => {
  promptFolderDescriptionMeasuredHeightCache.clear(promptFolderId)
}

export const clearPromptFolderDescriptionMeasuredHeights = (
  promptFolderIds: string[]
): void => {
  for (const promptFolderId of promptFolderIds) {
    promptFolderDescriptionMeasuredHeightCache.clear(promptFolderId)
  }
}
