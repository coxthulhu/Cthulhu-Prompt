import {
  type PromptFolderClientStateRecord,
  promptFolderClientStateCollection
} from '../Collections/PromptFolderClientStateCollection'
import {
  clearPromptFolderSettingsRowMeasuredHeight,
  clearPromptFolderSettingsRowMeasuredHeights,
  clearPromptFolderScrollTop,
  clearPromptFolderScrollTops
} from './PromptFolderUiCache.svelte.ts'

/** Creates the renderer-session client state for one prompt folder. */
const createPromptFolderClientStateRecord = (
  promptFolderId: string
): PromptFolderClientStateRecord => {
  return {
    id: promptFolderId,
    hasLoadedInitialData: false
  }
}

/** Adds missing prompt-folder load-state records without resetting existing state. */
export const upsertPromptFolderClientStates = (promptFolderIds: string[]): void => {
  if (promptFolderIds.length === 0) {
    return
  }

  /** Load-state records needed for folders not seen in this renderer session. */
  const clientStateInserts: PromptFolderClientStateRecord[] = []

  for (const promptFolderId of promptFolderIds) {
    if (promptFolderClientStateCollection.has(promptFolderId)) continue
    clearPromptFolderSettingsRowMeasuredHeight(promptFolderId)
    clearPromptFolderScrollTop(promptFolderId)
    clientStateInserts.push(createPromptFolderClientStateRecord(promptFolderId))
  }

  if (clientStateInserts.length > 0) {
    promptFolderClientStateCollection.insert(clientStateInserts)
  }
}

/** Updates whether one prompt folder has completed its initial screen load. */
export const setPromptFolderClientStateHasLoadedInitialData = (
  promptFolderId: string,
  hasLoadedInitialData: boolean
): void => {
  const clientState = promptFolderClientStateCollection.get(promptFolderId)
  if (!clientState || clientState.hasLoadedInitialData === hasLoadedInitialData) {
    return
  }

  promptFolderClientStateCollection.update(promptFolderId, (nextClientState) => {
    nextClientState.hasLoadedInitialData = hasLoadedInitialData
  })
}

/** Removes prompt-folder load state and its session-only UI cache entries. */
export const deletePromptFolderClientStates = (promptFolderIds: string[]): void => {
  if (promptFolderIds.length === 0) {
    return
  }

  clearPromptFolderSettingsRowMeasuredHeights(promptFolderIds)
  clearPromptFolderScrollTops(promptFolderIds)
  promptFolderClientStateCollection.delete(promptFolderIds)
}

/** Removes one prompt folder's load state and session-only UI cache entries. */
export const removePromptFolderClientState = (promptFolderId: string): void => {
  deletePromptFolderClientStates([promptFolderId])
}

/** Clears all prompt-folder load state for the current workspace. */
export const clearPromptFolderClientStateCollection = (): void => {
  const clientStateIds = Array.from(promptFolderClientStateCollection.keys(), (id) => String(id))
  deletePromptFolderClientStates(clientStateIds)
}
