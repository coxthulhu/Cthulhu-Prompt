import type { PromptFull, PromptSummaryData } from '@shared/Prompt'
import {
  type PromptDraftRecord,
  promptDraftCollection
} from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { createMarkdownContentDraftMutations } from './MarkdownContentDraftMutations'
import {
  clearPromptEditorMeasuredHeight,
  clearPromptEditorMeasuredHeights
} from './PromptDraftUiCache.svelte.ts'

export const promptDraftMutations = createMarkdownContentDraftMutations<
  PromptSummaryData,
  PromptFull,
  PromptDraftRecord
>({
  authoritativeCollectionId: promptCollection.id,
  getDraft: (promptId) => promptDraftCollection.get(promptId),
  getDrafts: () => promptDraftCollection.toArray,
  getDraftIds: () => Array.from(promptDraftCollection.keys(), (id) => String(id)),
  insertDrafts: (drafts) => {
    promptDraftCollection.insert(drafts)
  },
  updateDrafts: (promptIds, update) => {
    promptDraftCollection.update(promptIds, (drafts) => {
      for (const draft of drafts) update(draft)
    })
  },
  deleteDrafts: (promptIds) => {
    promptDraftCollection.delete(promptIds)
  },
  toSummaryDraft: (prompt) => ({
    id: prompt.id,
    title: prompt.title,
    fallbackTitle: prompt.fallbackTitle,
    createdAt: '',
    modifiedAt: prompt.modifiedAt,
    promptText: '',
    isEdited: false
  }),
  applySummary: (draft, prompt) => {
    draft.title = prompt.title
    draft.fallbackTitle = prompt.fallbackTitle
  },
  hasSameSummary: (draft, prompt) =>
    draft.title === prompt.title && draft.fallbackTitle === prompt.fallbackTitle,
  toFullDraft: (prompt, isEdited) => ({
    id: prompt.id,
    title: prompt.title,
    fallbackTitle: prompt.fallbackTitle,
    createdAt: prompt.createdAt,
    modifiedAt: prompt.modifiedAt,
    promptText: prompt.promptText,
    isEdited
  }),
  haveSameDraft: (left, right) =>
    left.id === right.id &&
    left.title === right.title &&
    left.fallbackTitle === right.fallbackTitle &&
    left.createdAt === right.createdAt &&
    left.modifiedAt === right.modifiedAt &&
    left.promptText === right.promptText &&
    left.isEdited === right.isEdited,
  beforeFullUpsert: (existing, next) => {
    if (!existing || existing.promptText !== next.promptText) {
      clearPromptEditorMeasuredHeight(next.id)
    }
  },
  beforeDelete: clearPromptEditorMeasuredHeights
})

export const upsertPromptDraft = (prompt: PromptFull): void => {
  promptDraftMutations.upsertDrafts([prompt])
}
