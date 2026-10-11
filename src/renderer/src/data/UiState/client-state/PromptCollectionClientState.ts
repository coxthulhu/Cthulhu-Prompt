import {
  type PromptCollectionClientStateRecord,
  promptCollectionClientStateCollection
} from '@renderer/data/Collections/PromptCollectionClientStateCollection'
import {
  clearPromptCollectionSettingsRowMeasuredHeight,
  clearPromptCollectionSettingsRowMeasuredHeights
} from '@renderer/data/UiState/cache/PromptCollectionUiCache.svelte.ts'

/** Creates the renderer-session client state for one prompt collection. */
const createPromptCollectionClientStateRecord = (
  promptCollectionId: string
): PromptCollectionClientStateRecord => {
  return {
    id: promptCollectionId,
    hasLoadedInitialData: false
  }
}

/** Adds missing prompt-collection load-state records without resetting existing state. */
export const upsertPromptCollectionClientStates = (promptCollectionIds: string[]): void => {
  if (promptCollectionIds.length === 0) {
    return
  }

  /** Load-state records needed for collections not seen in this renderer session. */
  const clientStateInserts: PromptCollectionClientStateRecord[] = []

  for (const promptCollectionId of promptCollectionIds) {
    if (promptCollectionClientStateCollection.has(promptCollectionId)) continue
    clearPromptCollectionSettingsRowMeasuredHeight(promptCollectionId)
    clientStateInserts.push(createPromptCollectionClientStateRecord(promptCollectionId))
  }

  if (clientStateInserts.length > 0) {
    promptCollectionClientStateCollection.insert(clientStateInserts)
  }
}

/** Updates whether one prompt collection has completed its initial screen load. */
export const setPromptCollectionClientStateHasLoadedInitialData = (
  promptCollectionId: string,
  hasLoadedInitialData: boolean
): void => {
  const clientState = promptCollectionClientStateCollection.get(promptCollectionId)
  if (!clientState || clientState.hasLoadedInitialData === hasLoadedInitialData) {
    return
  }

  promptCollectionClientStateCollection.update(promptCollectionId, (nextClientState) => {
    nextClientState.hasLoadedInitialData = hasLoadedInitialData
  })
}

/** Removes prompt-collection load state and its session-only UI cache entries. */
export const deletePromptCollectionClientStates = (promptCollectionIds: string[]): void => {
  if (promptCollectionIds.length === 0) {
    return
  }

  clearPromptCollectionSettingsRowMeasuredHeights(promptCollectionIds)
  promptCollectionClientStateCollection.delete(promptCollectionIds)
}

/** Removes one prompt collection's load state and session-only UI cache entries. */
export const removePromptCollectionClientState = (promptCollectionId: string): void => {
  deletePromptCollectionClientStates([promptCollectionId])
}

/** Clears all prompt-collection load state for the current workspace. */
export const clearPromptCollectionClientStateCollection = (): void => {
  const clientStateIds = Array.from(promptCollectionClientStateCollection.keys(), (id) => String(id))
  deletePromptCollectionClientStates(clientStateIds)
}
