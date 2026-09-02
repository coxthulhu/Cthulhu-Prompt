import type {
  PromptTemplateFull,
  PromptTemplatePersisted
} from '@shared/PromptTemplate'
import type { Draft } from 'immer'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { getOrderedMarkdownContentIds } from '@shared/MarkdownContent'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  promptTemplateClientStateCollection,
  type PromptTemplateClientStateRecord
} from '../Collections/PromptTemplateClientStateCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { mutatePacedPromptTemplateAutosaveUpdate } from '../Mutations/PromptTemplateMutations'
import {
  clearPromptEditorMeasuredHeights,
  recordPromptEditorMeasuredHeight
} from './PromptEditorUiCache.svelte.ts'
import { createMarkdownContentClientState } from './MarkdownContentClientState'

/** Lifecycle helpers for prompt-template client state and editor measurements. */
const clientState = createMarkdownContentClientState<PromptTemplateClientStateRecord>({
  authoritativeCollectionId: promptTemplateCollection.id,
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

/** Adds missing client-state records for loaded prompt templates. */
export const upsertPromptTemplateClientStates = clientState.upsertClientStates
/** Deletes prompt-template client state and associated UI caches. */
export const deletePromptTemplateClientStates = clientState.deleteClientStates
/** Deletes one prompt template's client state and associated UI cache. */
export const removePromptTemplateClientState = clientState.removeClientState
/** Flushes autosaves associated with prompt-template client state. */
export const flushPromptTemplateClientStateAutosaves = clientState.flushAutosaves
/** Clears all prompt-template client state for the current workspace. */
export const clearPromptTemplateClientStateCollection = clientState.clearClientStateCollection

const getSiblingTemplateIds = (templateId: string): string[] => {
  for (const folder of promptFolderCollection.values()) {
    if (folder.kind !== 'template') continue
    const templateIds = getOrderedMarkdownContentIds(folder, 'template')
    if (templateIds.includes(templateId)) return templateIds
  }
  return [templateId]
}

/** Schedules one authoritative template edit and latches its client-state marker. */
const mutatePromptTemplate = (
  templateId: string,
  mutateTemplate: (template: Draft<PromptTemplatePersisted>) => void
): void => {
  mutatePacedPromptTemplateAutosaveUpdate({
    templateId,
    debounceMs: AUTOSAVE_MS,
    mutateContent: mutateTemplate
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
    draft.modifiedAt = modifiedAt
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
    draft.templateText = templateText
    draft.modifiedAt = modifiedAt
  })
}
