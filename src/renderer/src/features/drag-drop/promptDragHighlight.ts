import {
  promptIdToPromptNavigationRow,
  type PromptNavigationContext
} from '@renderer/app/PromptNavigationContext.svelte.ts'
import type { PromptHandleDragPayload } from './promptHandleDrag'

export const highlightDraggedPrompt = (
  promptNavigation: PromptNavigationContext,
  payload: PromptHandleDragPayload
): void => {
  promptNavigation.setHighlightedRowOverride({
    folderId: payload.sourceFolderId,
    row: promptIdToPromptNavigationRow(payload.fromId)
  })
}

export const clearDraggedPromptHighlight = (promptNavigation: PromptNavigationContext): void => {
  promptNavigation.clearHighlightedRowOverride()
}
