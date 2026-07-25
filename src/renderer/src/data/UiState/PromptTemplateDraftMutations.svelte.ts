import type {
  PromptTemplate,
  PromptTemplateFull,
  PromptTemplateSummaryData
} from '@shared/PromptTemplate'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { getActiveMarkdownContentIds } from '@shared/MarkdownContent'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  promptTemplateDraftCollection,
  type PromptTemplateDraftRecord
} from '../Collections/PromptTemplateDraftCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { mutatePacedPromptTemplateAutosaveUpdate } from '../Mutations/PromptTemplateMutations'
import { recordPromptEditorMeasuredHeight } from './PromptDraftUiCache.svelte.ts'
import {
  clearPromptEditorMeasuredHeight,
  clearPromptEditorMeasuredHeights
} from './PromptDraftUiCache.svelte.ts'
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
    left.isEdited === right.isEdited,
  beforeFullUpsert: (existing, next) => {
    if (!existing || existing.templateText !== next.templateText) {
      clearPromptEditorMeasuredHeight(next.id)
    }
  },
  beforeDelete: clearPromptEditorMeasuredHeights
})

export const upsertPromptTemplateSummaryDrafts = draftMutations.upsertSummaryDrafts
export const upsertPromptTemplateDrafts = draftMutations.upsertDrafts
export const deletePromptTemplateDrafts = draftMutations.deleteDrafts
export const removePromptTemplateDraft = draftMutations.removeDraft
export const flushPromptTemplateDraftAutosaves = draftMutations.flushAutosaves
export const clearPromptTemplateDraftStore = draftMutations.clearDraftStore

const getSiblingTemplateIds = (templateId: string): string[] => {
  for (const folder of promptFolderCollection.values()) {
    if (folder.kind !== 'template') continue
    const templateIds = getActiveMarkdownContentIds(folder, 'template')
    if (templateIds.includes(templateId)) return templateIds
  }
  return [templateId]
}

const mutateTemplateDraft = (
  templateId: string,
  mutateDraft: (draft: PromptTemplateDraftRecord) => void,
  mutateTemplate?: (template: PromptTemplate) => void
): void => {
  mutatePacedPromptTemplateAutosaveUpdate({
    templateId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.promptTemplateDraft.update(templateId, (draft) => {
        mutateDraft(draft)
        draft.isEdited = true
      })
      if (mutateTemplate) collections.promptTemplate.update(templateId, mutateTemplate)
    }
  })
}

export const setPromptTemplateDraftTitle = (templateId: string, title: string): void => {
  const draft = promptTemplateDraftCollection.get(templateId)!
  const nextTitleFields = resolvePromptTitleUpdateForPromptIds({
    promptIds: getSiblingTemplateIds(templateId),
    lookupPrompt: (contentId) => promptTemplateCollection.get(contentId),
    promptId: templateId,
    currentTitle: draft.title,
    currentFallbackTitle: draft.fallbackTitle,
    nextTitle: title
  })
  if (draft.title === nextTitleFields.title && draft.fallbackTitle === nextTitleFields.fallbackTitle) {
    return
  }

  const modifiedAt = getCurrentIsoSecondTimestamp()
  mutateTemplateDraft(
    templateId,
    (nextDraft) => {
      Object.assign(nextDraft, nextTitleFields, { modifiedAt })
    },
    (template) => {
      Object.assign(template, nextTitleFields)
      if (template.loadingState === 'full') template.modifiedAt = modifiedAt
    }
  )
}

export const setPromptTemplateDraftText = (
  templateId: string,
  templateText: string,
  measurement: TextMeasurement
): void => {
  const draft = promptTemplateDraftCollection.get(templateId)!
  const textChanged = draft.templateText !== templateText
  recordPromptEditorMeasuredHeight(templateId, measurement, textChanged)
  if (!textChanged) return

  const modifiedAt = getCurrentIsoSecondTimestamp()
  mutateTemplateDraft(
    templateId,
    (nextDraft) => {
      nextDraft.templateText = templateText
      nextDraft.modifiedAt = modifiedAt
    },
    (template) => {
      if (template.loadingState === 'summary') return
      template.templateText = templateText
      template.modifiedAt = modifiedAt
    }
  )
}
