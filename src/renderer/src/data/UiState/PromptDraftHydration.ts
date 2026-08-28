import type { PromptFull } from '@shared/Prompt'
import {
  type PromptDraftRecord,
  promptDraftCollection
} from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { createMarkdownContentDraftMutations } from './MarkdownContentDraftMutations'
import {
  clearPromptEditorMeasuredHeights
} from './PromptDraftUiCache.svelte.ts'

/** Lifecycle helpers for prompt edit markers and prompt editor measurements. */
export const promptDraftMutations = createMarkdownContentDraftMutations<PromptDraftRecord>({
  authoritativeCollectionId: promptCollection.id,
  getDraft: (promptId) => promptDraftCollection.get(promptId),
  getDrafts: () => promptDraftCollection.toArray,
  getDraftIds: () => Array.from(promptDraftCollection.keys(), (id) => String(id)),
  insertDrafts: (drafts) => {
    promptDraftCollection.insert(drafts)
  },
  deleteDrafts: (promptIds) => {
    promptDraftCollection.delete(promptIds)
  },
  createDraft: (promptId) => ({ id: promptId, isEdited: false }),
  beforeDelete: clearPromptEditorMeasuredHeights
})

/** Ensures a prompt has a renderer-session edit marker. */
export const upsertPromptDraft = (prompt: PromptFull): void => {
  promptDraftMutations.upsertDrafts([prompt])
}
