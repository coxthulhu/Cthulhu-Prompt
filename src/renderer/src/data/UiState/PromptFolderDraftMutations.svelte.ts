import {
  type PromptFolderDraftRecord,
  promptFolderDraftCollection
} from '../Collections/PromptFolderDraftCollection'
import {
  clearPromptFolderSettingsRowMeasuredHeight,
  clearPromptFolderSettingsRowMeasuredHeights,
  clearPromptFolderScrollTop,
  clearPromptFolderScrollTops
} from './PromptFolderDraftUiCache.svelte.ts'

/** Creates the renderer-session load state for one prompt folder. */
const createPromptFolderDraftRecord = (promptFolderId: string): PromptFolderDraftRecord => {
  return {
    id: promptFolderId,
    hasLoadedInitialData: false
  }
}

/** Adds missing prompt-folder load-state records without resetting existing state. */
export const upsertPromptFolderDrafts = (promptFolderIds: string[]): void => {
  if (promptFolderIds.length === 0) {
    return
  }

  /** Load-state records needed for folders not seen in this renderer session. */
  const draftInserts: PromptFolderDraftRecord[] = []

  for (const promptFolderId of promptFolderIds) {
    if (promptFolderDraftCollection.has(promptFolderId)) continue
    clearPromptFolderSettingsRowMeasuredHeight(promptFolderId)
    clearPromptFolderScrollTop(promptFolderId)
    draftInserts.push(createPromptFolderDraftRecord(promptFolderId))
  }

  if (draftInserts.length > 0) {
    promptFolderDraftCollection.insert(draftInserts)
  }
}

/** Updates whether one prompt folder has completed its initial screen load. */
export const setPromptFolderDraftHasLoadedInitialData = (
  promptFolderId: string,
  hasLoadedInitialData: boolean
): void => {
  const draftRecord = promptFolderDraftCollection.get(promptFolderId)
  if (!draftRecord || draftRecord.hasLoadedInitialData === hasLoadedInitialData) {
    return
  }

  promptFolderDraftCollection.update(promptFolderId, (draft) => {
    draft.hasLoadedInitialData = hasLoadedInitialData
  })
}

/** Removes prompt-folder load state and its session-only UI cache entries. */
export const deletePromptFolderDrafts = (promptFolderIds: string[]): void => {
  if (promptFolderIds.length === 0) {
    return
  }

  clearPromptFolderSettingsRowMeasuredHeights(promptFolderIds)
  clearPromptFolderScrollTops(promptFolderIds)
  promptFolderDraftCollection.delete(promptFolderIds)
}

/** Removes one prompt folder's load state and session-only UI cache entries. */
export const removePromptFolderDraft = (promptFolderId: string): void => {
  deletePromptFolderDrafts([promptFolderId])
}

/** Clears all prompt-folder load state for the current workspace. */
export const clearPromptFolderDraftStore = (): void => {
  const draftIds = Array.from(promptFolderDraftCollection.keys(), (draftId) => String(draftId))
  deletePromptFolderDrafts(draftIds)
}
