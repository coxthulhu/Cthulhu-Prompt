import type {
  PromptTemplate,
  PromptTemplateFull
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
  clearPromptEditorMeasuredHeights
} from './PromptDraftUiCache.svelte.ts'
import { createMarkdownContentDraftMutations } from './MarkdownContentDraftMutations'

/** Lifecycle helpers for prompt-template edit markers and editor measurements. */
const draftMutations = createMarkdownContentDraftMutations<PromptTemplateDraftRecord>({
  authoritativeCollectionId: promptTemplateCollection.id,
  getDraft: (templateId) => promptTemplateDraftCollection.get(templateId),
  getDrafts: () => promptTemplateDraftCollection.toArray,
  getDraftIds: () => Array.from(promptTemplateDraftCollection.keys(), (id) => String(id)),
  insertDrafts: (drafts) => {
    promptTemplateDraftCollection.insert(drafts)
  },
  deleteDrafts: (templateIds) => {
    promptTemplateDraftCollection.delete(templateIds)
  },
  createDraft: (templateId) => ({ id: templateId, isEdited: false }),
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

/** Schedules one authoritative template edit and latches its session marker. */
const mutatePromptTemplate = (
  templateId: string,
  mutateTemplate: (template: PromptTemplate) => void
): void => {
  mutatePacedPromptTemplateAutosaveUpdate({
    templateId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.promptTemplateDraft.update(templateId, (draft) => {
        draft.isEdited = true
      })
      collections.promptTemplate.update(templateId, mutateTemplate)
    }
  })
}

/** Updates a prompt template title and schedules its autosave. */
export const setPromptTemplateTitle = (templateId: string, title: string): void => {
  /** Canonical template receiving the title edit. */
  const template = promptTemplateCollection.get(templateId)!
  const nextTitleFields = resolvePromptTitleUpdateForPromptIds({
    promptIds: getSiblingTemplateIds(templateId),
    lookupPrompt: (contentId) => promptTemplateCollection.get(contentId),
    promptId: templateId,
    currentTitle: template.title,
    currentFallbackTitle: template.fallbackTitle,
    nextTitle: title
  })
  if (
    template.title === nextTitleFields.title &&
    template.fallbackTitle === nextTitleFields.fallbackTitle
  ) {
    return
  }

  const modifiedAt = getCurrentIsoSecondTimestamp()
  mutatePromptTemplate(templateId, (draft) => {
    Object.assign(draft, nextTitleFields)
    if (draft.loadingState === 'full') draft.modifiedAt = modifiedAt
  })
}

/** Updates prompt-template text, records its height, and schedules its autosave. */
export const setPromptTemplateText = (
  templateId: string,
  templateText: string,
  measurement: TextMeasurement
): void => {
  /** Canonical full template receiving the text edit. */
  const template = promptTemplateCollection.get(templateId) as PromptTemplateFull
  const textChanged = template.templateText !== templateText
  recordPromptEditorMeasuredHeight(templateId, measurement, textChanged)
  if (!textChanged) return

  const modifiedAt = getCurrentIsoSecondTimestamp()
  mutatePromptTemplate(templateId, (draft) => {
    if (draft.loadingState === 'summary') return
    draft.templateText = templateText
    draft.modifiedAt = modifiedAt
  })
}
