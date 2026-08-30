import type { PromptFull, PromptPersisted, PromptTemplateReference } from '@shared/Prompt'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import type { Draft } from 'immer'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getPromptFolderPromptIds } from '../Collections/PromptFolderEntries'
import { mutatePacedPromptAutosaveUpdate } from '../Mutations/PromptMutations'
import { promptClientState, upsertPromptClientState } from './PromptClientState'
import { recordPromptEditorMeasuredHeight } from './PromptEditorUiCache.svelte.ts'

/** Optimistic authoritative prompt update paired with its session edit marker. */
type PromptOptimisticMutationOptions = {
  mutatePrompt: (draft: Draft<PromptPersisted>) => void
}

/** Returns the timestamp applied to one prompt edit. */
const getPromptModifiedAt = (): string => getCurrentIsoSecondTimestamp()

/** Returns active sibling prompt IDs used to resolve fallback-title collisions. */
const getPromptIdsForPrompt = (promptId: string): string[] => {
  for (const promptFolder of promptFolderCollection.values()) {
    const promptIds = getPromptFolderPromptIds(promptFolder)
    if (promptIds.includes(promptId)) return promptIds
  }
  return [promptId]
}

/** Schedules one authoritative prompt edit and latches its client-state marker. */
const mutatePromptOptimistically = (
  promptId: string,
  { mutatePrompt }: PromptOptimisticMutationOptions
): void => {
  mutatePacedPromptAutosaveUpdate({
    promptId,
    debounceMs: AUTOSAVE_MS,
    mutateContent: mutatePrompt
  })
}

export { upsertPromptClientState }
/** Adds missing client-state records for loaded prompts. */
export const upsertPromptClientStates = promptClientState.upsertClientStates

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
      draft.modifiedAt = modifiedAt
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
      draft.promptText = promptText
      draft.modifiedAt = modifiedAt
    }
  })
}

/** Replaces a prompt's ordered template selection and schedules its autosave. */
export const setPromptTemplates = (
  promptId: string,
  templates: PromptTemplateReference[] | null
): void => {
  const modifiedAt = getPromptModifiedAt()
  mutatePromptOptimistically(promptId, {
    mutatePrompt: (draft) => {
      draft.templates = templates
      draft.modifiedAt = modifiedAt
    }
  })
}

/** Flushes autosaves associated with prompt client state. */
export const flushPromptClientStateAutosaves = promptClientState.flushAutosaves
/** Deletes prompt client state and associated UI caches. */
export const deletePromptClientStates = promptClientState.deleteClientStates
/** Deletes one prompt's client state and associated UI cache. */
export const removePromptClientState = promptClientState.removeClientState
/** Clears all prompt client state for the current workspace. */
export const clearPromptClientStateCollection = promptClientState.clearClientStateCollection
