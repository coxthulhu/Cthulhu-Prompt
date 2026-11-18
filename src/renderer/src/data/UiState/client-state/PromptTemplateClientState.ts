import {
  type PromptTemplateClientStateRecord,
  promptTemplateClientStateCollection
} from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { createMarkdownContentClientState } from './MarkdownContentClientState'
import { clearPromptEditorMeasuredHeights } from '@renderer/data/UiState/cache/PromptEditorUiCache.svelte.ts'

/** Lifecycle helpers for prompt-template client state and editor measurements. */
export const promptTemplateClientState = createMarkdownContentClientState<PromptTemplateClientStateRecord>({
  authoritativeCollectionId: promptTemplatesCollection.id,
  getClientState: (templateId) => promptTemplateClientStateCollection.get(templateId),
  getClientStates: () => promptTemplateClientStateCollection.toArray,
  getClientStateIds: () =>
    Array.from(promptTemplateClientStateCollection.keys(), (id) => String(id)),
  insertClientStates: (clientStates) => {
    promptTemplateClientStateCollection.insert(clientStates)
  },
  deleteClientStates: (templateIds) => {
    promptTemplateClientStateCollection.delete(templateIds)
  },
  createClientState: (templateId) => ({ id: templateId, isEdited: false }),
  beforeDelete: clearPromptEditorMeasuredHeights
})
