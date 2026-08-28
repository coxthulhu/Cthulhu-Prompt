import type { PromptFull } from '@shared/Prompt'
import {
  type PromptClientStateRecord,
  promptClientStateCollection
} from '../Collections/PromptClientStateCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { createMarkdownContentClientState } from './MarkdownContentClientState'
import { clearPromptEditorMeasuredHeights } from './PromptEditorUiCache.svelte.ts'

/** Lifecycle helpers for prompt client state and prompt editor measurements. */
export const promptClientState = createMarkdownContentClientState<PromptClientStateRecord>({
  authoritativeCollectionId: promptCollection.id,
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
