import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { createSessionMeasuredHeightCache } from './sessionUiCacheFactories.svelte.ts'

const editorMeasuredHeight = createSessionMeasuredHeightCache()

export const promptDraftUiCache = {
  editorMeasuredHeight
}

export const lookupPromptEditorMeasuredHeight = (
  promptId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptDraftUiCache.editorMeasuredHeight.lookup(promptId, widthPx, devicePixelRatio)
}

export const recordPromptEditorMeasuredHeight = (
  promptId: string,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  promptDraftUiCache.editorMeasuredHeight.record(promptId, measurement, textChanged)
}

export const clearPromptEditorMeasuredHeight = (promptId: string): void => {
  promptDraftUiCache.editorMeasuredHeight.clear(promptId)
}

export const clearPromptEditorMeasuredHeights = (promptIds: string[]): void => {
  promptDraftUiCache.editorMeasuredHeight.clearMany(promptIds)
}
