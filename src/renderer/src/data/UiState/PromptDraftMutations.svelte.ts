import type { Prompt, PromptFull, PromptTemplateReference } from '@shared/Prompt'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  markPromptDraftEdited
} from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getPromptFolderPromptIds } from '../Collections/PromptFolderEntries'
import { mutatePacedPromptAutosaveUpdate } from '../Mutations/PromptMutations'
import { promptDraftMutations, upsertPromptDraft } from './PromptDraftHydration'
import { recordPromptEditorMeasuredHeight } from './PromptDraftUiCache.svelte.ts'

/** Optimistic authoritative prompt update paired with its session edit marker. */
type PromptOptimisticMutationOptions = {
  mutatePrompt: (draft: Prompt) => void
}

/** Returns the timestamp applied to one prompt edit. */
const getPromptModifiedAt = (): string => new Date().toISOString()

/** Returns active sibling prompt IDs used to resolve fallback-title collisions. */
const getPromptIdsForPrompt = (promptId: string): string[] => {
  for (const promptFolder of promptFolderCollection.values()) {
    const promptIds = getPromptFolderPromptIds(promptFolder)
    if (promptIds.includes(promptId)) return promptIds
  }
  return [promptId]
}

/** Schedules one authoritative prompt edit and latches its session marker. */
const mutatePromptOptimistically = (
  promptId: string,
  { mutatePrompt }: PromptOptimisticMutationOptions
): void => {
  mutatePacedPromptAutosaveUpdate({
    promptId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.promptDraft.update(promptId, (draft) => {
        markPromptDraftEdited(draft)
      })
      collections.prompt.update(promptId, mutatePrompt)
    }
  })
}

export { upsertPromptDraft }
export const upsertPromptSummaryDrafts = promptDraftMutations.upsertSummaryDrafts
export const upsertPromptDrafts = promptDraftMutations.upsertDrafts

/** Updates a prompt title and schedules its autosave. */
export const setPromptTitle = (promptId: string, title: string): void => {
  /** Canonical prompt receiving the title edit. */
  const prompt = promptCollection.get(promptId)!
  const nextTitleFields = resolvePromptTitleUpdateForPromptIds({
    promptIds: getPromptIdsForPrompt(promptId),
    lookupPrompt: (currentPromptId) => promptCollection.get(currentPromptId),
    promptId,
    currentTitle: prompt.title,
    currentFallbackTitle: prompt.fallbackTitle,
    nextTitle: title
  })
  if (
    prompt.title === nextTitleFields.title &&
    prompt.fallbackTitle === nextTitleFields.fallbackTitle
  ) {
    return
  }

  const modifiedAt = getPromptModifiedAt()
  mutatePromptOptimistically(promptId, {
    mutatePrompt: (draft) => {
      draft.title = nextTitleFields.title
      draft.fallbackTitle = nextTitleFields.fallbackTitle
      if (draft.loadingState === 'full') draft.modifiedAt = modifiedAt
    }
  })
}

/** Updates prompt text, records its height, and schedules its autosave. */
export const setPromptText = (
  promptId: string,
  promptText: string,
  measurement: TextMeasurement
): void => {
  /** Canonical full prompt receiving the text edit. */
  const prompt = promptCollection.get(promptId) as PromptFull
  const textChanged = prompt.promptText !== promptText
  recordPromptEditorMeasuredHeight(promptId, measurement, textChanged)
  if (!textChanged) return

  const modifiedAt = getPromptModifiedAt()
  mutatePromptOptimistically(promptId, {
    mutatePrompt: (draft) => {
      if (draft.loadingState === 'summary') return
      draft.promptText = promptText
      draft.modifiedAt = modifiedAt
    }
  })
}

// Replaces a prompt's ordered template selection and schedules its autosave.
export const setPromptTemplates = (
  promptId: string,
  templates: PromptTemplateReference[] | null
): void => {
  const modifiedAt = getPromptModifiedAt()
  mutatePromptOptimistically(promptId, {
    mutatePrompt: (draft) => {
      draft.templates = templates
      if (draft.loadingState === 'full') draft.modifiedAt = modifiedAt
    }
  })
}

export const flushPromptDraftAutosaves = promptDraftMutations.flushAutosaves
export const deletePromptDrafts = promptDraftMutations.deleteDrafts
export const removePromptDraft = promptDraftMutations.removeDraft
export const clearPromptDraftStore = promptDraftMutations.clearDraftStore
