import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { createSessionMeasuredHeightCache } from './sessionUiCacheFactories.svelte.ts'

const editorMeasuredHeight = createSessionMeasuredHeightCache()

/** Renderer-session measurements shared by prompt and template editors. */
export const promptEditorUiCache = {
  editorMeasuredHeight
}

export const lookupPromptEditorMeasuredHeight = (
  promptId: string,
  widthPx: number,
  devicePixelRatio: number
): number | null => {
  return promptEditorUiCache.editorMeasuredHeight.lookup(promptId, widthPx, devicePixelRatio)
}

export const recordPromptEditorMeasuredHeight = (
  promptId: string,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  promptEditorUiCache.editorMeasuredHeight.record(promptId, measurement, textChanged)
}

export const clearPromptEditorMeasuredHeight = (promptId: string): void => {
  promptEditorUiCache.editorMeasuredHeight.clear(promptId)
}

export const clearPromptEditorMeasuredHeights = (promptIds: string[]): void => {
  promptEditorUiCache.editorMeasuredHeight.clearMany(promptIds)
}
