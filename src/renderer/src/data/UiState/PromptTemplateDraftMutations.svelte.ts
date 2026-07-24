import type {
  PromptTemplateFull,
  PromptTemplateSummaryData
} from '@shared/PromptTemplate'
import {
  promptTemplateDraftCollection,
  type PromptTemplateDraftRecord
} from '../Collections/PromptTemplateDraftCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { createMarkdownContentDraftMutations } from './MarkdownContentDraftMutations'

const draftMutations = createMarkdownContentDraftMutations<
  PromptTemplateSummaryData,
  PromptTemplateFull,
  PromptTemplateDraftRecord
>({
  authoritativeCollectionId: promptTemplateCollection.id,
  getDraft: (templateId) => promptTemplateDraftCollection.get(templateId),
  getDrafts: () => promptTemplateDraftCollection.toArray,
  getDraftIds: () => Array.from(promptTemplateDraftCollection.keys(), (id) => String(id)),
  insertDrafts: (drafts) => {
    promptTemplateDraftCollection.insert(drafts)
  },
  updateDrafts: (templateIds, update) => {
    promptTemplateDraftCollection.update(templateIds, (drafts) => {
      for (const draft of drafts) update(draft)
    })
  },
  deleteDrafts: (templateIds) => {
    promptTemplateDraftCollection.delete(templateIds)
  },
  toSummaryDraft: (template) => ({
    id: template.id,
    title: template.title,
    fallbackTitle: template.fallbackTitle,
    createdAt: '',
    modifiedAt: template.modifiedAt,
    templateText: '',
    isEdited: false
  }),
  applySummary: (draft, template) => {
    draft.title = template.title
    draft.fallbackTitle = template.fallbackTitle
    draft.modifiedAt = template.modifiedAt
  },
  hasSameSummary: (draft, template) =>
    draft.title === template.title &&
    draft.fallbackTitle === template.fallbackTitle &&
    draft.modifiedAt === template.modifiedAt,
  toFullDraft: (template, isEdited) => ({
    id: template.id,
    title: template.title,
    fallbackTitle: template.fallbackTitle,
    createdAt: template.createdAt,
    modifiedAt: template.modifiedAt,
    templateText: template.templateText,
    isEdited
  }),
  haveSameDraft: (left, right) =>
    left.id === right.id &&
    left.title === right.title &&
    left.fallbackTitle === right.fallbackTitle &&
    left.createdAt === right.createdAt &&
    left.modifiedAt === right.modifiedAt &&
    left.templateText === right.templateText &&
    left.isEdited === right.isEdited
})

export const upsertPromptTemplateSummaryDrafts = draftMutations.upsertSummaryDrafts
export const upsertPromptTemplateDrafts = draftMutations.upsertDrafts
export const deletePromptTemplateDrafts = draftMutations.deleteDrafts
export const removePromptTemplateDraft = draftMutations.removeDraft
export const flushPromptTemplateDraftAutosaves = draftMutations.flushAutosaves
export const clearPromptTemplateDraftStore = draftMutations.clearDraftStore
