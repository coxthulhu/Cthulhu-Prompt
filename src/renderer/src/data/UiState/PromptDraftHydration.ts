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

// Compares ordered template references by ID while preserving null and missing states.
const haveSamePromptTemplates = (
  left: PromptFull['templates'],
  right: PromptFull['templates']
): boolean =>
  left === right ||
  (Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((template, index) => template.id === right[index].id))

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
    ...(prompt.category !== undefined ? { category: prompt.category } : {}),
    promptText: '',
    templates: prompt.templates,
    isEdited: false
  }),
  applySummary: (draft, prompt) => {
    draft.title = prompt.title
    draft.fallbackTitle = prompt.fallbackTitle
    draft.category = prompt.category
    draft.templates = prompt.templates
  },
  hasSameSummary: (draft, prompt) =>
    draft.title === prompt.title &&
    draft.fallbackTitle === prompt.fallbackTitle &&
    draft.category === prompt.category &&
    haveSamePromptTemplates(draft.templates, prompt.templates),
  toFullDraft: (prompt, isEdited) => ({
    id: prompt.id,
    title: prompt.title,
    fallbackTitle: prompt.fallbackTitle,
    createdAt: prompt.createdAt,
    modifiedAt: prompt.modifiedAt,
    ...(prompt.category !== undefined ? { category: prompt.category } : {}),
    promptText: prompt.promptText,
    templates: prompt.templates,
    isEdited
  }),
  haveSameDraft: (left, right) =>
    left.id === right.id &&
    left.title === right.title &&
    left.fallbackTitle === right.fallbackTitle &&
    left.createdAt === right.createdAt &&
    left.modifiedAt === right.modifiedAt &&
    left.category === right.category &&
    left.promptText === right.promptText &&
    haveSamePromptTemplates(left.templates, right.templates) &&
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
