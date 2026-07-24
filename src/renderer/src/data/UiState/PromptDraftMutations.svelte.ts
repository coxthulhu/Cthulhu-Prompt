import type { Prompt } from '@shared/Prompt'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  markPromptDraftEdited,
  type PromptDraftRecord,
  promptDraftCollection
} from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getPromptFolderPromptIds } from '../Collections/PromptFolderEntries'
import { mutatePacedPromptAutosaveUpdate } from '../Mutations/PromptMutations'
import { promptDraftMutations, upsertPromptDraft } from './PromptDraftHydration'
import { recordPromptEditorMeasuredHeight } from './PromptDraftUiCache.svelte.ts'

export type PromptDraftState = PromptDraftRecord

type PromptDraftOptimisticMutationOptions = {
  mutatePromptDraft: (draft: PromptDraftRecord) => void
  mutatePrompt?: (draft: Prompt) => void
}

const getPromptDraftModifiedAt = (): string => new Date().toISOString()

const getPromptIdsForPrompt = (promptId: string): string[] => {
  for (const promptFolder of promptFolderCollection.values()) {
    const promptIds = getPromptFolderPromptIds(promptFolder)
    if (promptIds.includes(promptId)) return promptIds
  }
  return [promptId]
}

const mutatePromptDraftOptimistically = (
  promptId: string,
  { mutatePromptDraft, mutatePrompt }: PromptDraftOptimisticMutationOptions
): void => {
  mutatePacedPromptAutosaveUpdate({
    promptId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.promptDraft.update(promptId, (draft) => {
        mutatePromptDraft(draft)
        markPromptDraftEdited(draft)
      })
      if (mutatePrompt) collections.prompt.update(promptId, mutatePrompt)
    }
  })
}

export { upsertPromptDraft }
export const upsertPromptSummaryDrafts = promptDraftMutations.upsertSummaryDrafts
export const upsertPromptDrafts = promptDraftMutations.upsertDrafts

export const getPromptDraftState = (promptId: string): PromptDraftState =>
  promptDraftCollection.get(promptId)!

export const setPromptDraftTitle = (promptId: string, title: string): void => {
  const draftRecord = getPromptDraftState(promptId)
  const nextTitleFields = resolvePromptTitleUpdateForPromptIds({
    promptIds: getPromptIdsForPrompt(promptId),
    lookupPrompt: (currentPromptId) => promptCollection.get(currentPromptId),
    promptId,
    currentTitle: draftRecord.title,
    currentFallbackTitle: draftRecord.fallbackTitle,
    nextTitle: title
  })
  if (
    draftRecord.title === nextTitleFields.title &&
    draftRecord.fallbackTitle === nextTitleFields.fallbackTitle
  ) {
    return
  }

  const modifiedAt = getPromptDraftModifiedAt()
  mutatePromptDraftOptimistically(promptId, {
    mutatePromptDraft: (draft) => {
      draft.title = nextTitleFields.title
      draft.fallbackTitle = nextTitleFields.fallbackTitle
      draft.modifiedAt = modifiedAt
    },
    mutatePrompt: (draft) => {
      draft.title = nextTitleFields.title
      draft.fallbackTitle = nextTitleFields.fallbackTitle
      if (draft.loadingState === 'full') draft.modifiedAt = modifiedAt
    }
  })
}

export const setPromptDraftText = (
  promptId: string,
  promptText: string,
  measurement: TextMeasurement
): void => {
  const draftRecord = getPromptDraftState(promptId)
  const textChanged = draftRecord.promptText !== promptText
  recordPromptEditorMeasuredHeight(promptId, measurement, textChanged)
  if (!textChanged) return

  const modifiedAt = getPromptDraftModifiedAt()
  mutatePromptDraftOptimistically(promptId, {
    mutatePromptDraft: (draft) => {
      draft.promptText = promptText
      draft.modifiedAt = modifiedAt
    },
    mutatePrompt: (draft) => {
      if (draft.loadingState === 'summary') return
      draft.promptText = promptText
      draft.modifiedAt = modifiedAt
    }
  })
}

export const flushPromptDraftAutosaves = promptDraftMutations.flushAutosaves
export const deletePromptDrafts = promptDraftMutations.deleteDrafts
export const removePromptDraft = promptDraftMutations.removeDraft
export const clearPromptDraftStore = promptDraftMutations.clearDraftStore
