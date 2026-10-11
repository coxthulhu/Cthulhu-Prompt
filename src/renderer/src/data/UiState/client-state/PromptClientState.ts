import type { PromptFull } from '@shared/domain/prompt/Prompt'
import {
  type PromptClientStateRecord,
  promptClientStateCollection
} from '@renderer/data/Collections/PromptClientStateCollection'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { createMarkdownContentClientState } from './MarkdownContentClientState'
import { clearPromptEditorMeasuredHeights } from '@renderer/data/UiState/cache/PromptEditorUiCache.svelte.ts'

/** Lifecycle helpers for prompt client state and prompt editor measurements. */
export const promptClientState = createMarkdownContentClientState<PromptClientStateRecord>({
  authoritativeCollectionId: promptsCollection.id,
  getClientState: (promptId) => promptClientStateCollection.get(promptId),
  getClientStates: () => promptClientStateCollection.toArray,
  getClientStateIds: () => Array.from(promptClientStateCollection.keys(), (id) => String(id)),
  insertClientStates: (clientStates) => {
    promptClientStateCollection.insert(clientStates)
  },
  deleteClientStates: (promptIds) => {
    promptClientStateCollection.delete(promptIds)
  },
  createClientState: (promptId) => ({ id: promptId, isEdited: false }),
  beforeDelete: clearPromptEditorMeasuredHeights
})

/** Ensures a prompt has renderer-session client state. */
export const upsertPromptClientState = (prompt: PromptFull): void => {
  promptClientState.upsertClientStates([prompt])
}
