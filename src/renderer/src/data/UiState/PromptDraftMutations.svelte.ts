import type { Prompt, PromptFull, PromptSummaryData } from '@shared/Prompt'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { type PromptDraftRecord, promptDraftCollection } from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedPromptAutosaveUpdate } from '../Mutations/PromptMutations'
import {
  clearPromptEditorMeasuredHeight,
  clearPromptEditorMeasuredHeights,
  recordPromptEditorMeasuredHeight
} from './PromptDraftUiCache.svelte.ts'

export type PromptDraftState = PromptDraftRecord

const toPromptSnapshot = (prompt: PromptFull): PromptDraftRecord => ({
  id: prompt.id,
  title: prompt.title,
  fallbackTitle: prompt.fallbackTitle,
  createdAt: prompt.createdAt,
  modifiedAt: prompt.modifiedAt,
  promptText: prompt.promptText
})

const toPromptSummaryDraftSnapshot = (prompt: PromptSummaryData): PromptDraftRecord => ({
  id: prompt.id,
  title: prompt.title,
  fallbackTitle: prompt.fallbackTitle,
  createdAt: '',
  modifiedAt: '',
  promptText: ''
})

const haveSamePrompt = (left: PromptDraftRecord, right: PromptDraftRecord): boolean => {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.fallbackTitle === right.fallbackTitle &&
    left.createdAt === right.createdAt &&
    left.modifiedAt === right.modifiedAt &&
    left.promptText === right.promptText
  )
}

const getPromptDraftModifiedAt = (): string => {
  return new Date().toISOString()
}

type PromptDraftOptimisticMutationOptions = {
  mutatePromptDraft: (draft: PromptDraftRecord) => void
  mutatePrompt?: (draft: Prompt) => void
  promptFolderModifiedAt?: string
}

const getPromptIdsForPrompt = (promptId: string): string[] => {
  for (const promptFolder of promptFolderCollection.values()) {
    if (promptFolder.promptIds.includes(promptId)) {
      return promptFolder.promptIds
    }
  }

  return [promptId]
}

const getPromptFolderIdForPrompt = (promptId: string): string | null => {
  for (const promptFolder of promptFolderCollection.values()) {
    if (promptFolder.promptIds.includes(promptId)) {
      return promptFolder.id
    }
  }

  return null
}

const mutatePromptDraftOptimistically = (
  promptId: string,
  options: PromptDraftOptimisticMutationOptions
): void => {
  const { mutatePromptDraft, mutatePrompt, promptFolderModifiedAt } = options
  const promptFolderId = getPromptFolderIdForPrompt(promptId)

  mutatePacedPromptAutosaveUpdate({
    promptId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.promptDraft.update(promptId, mutatePromptDraft)

      if (mutatePrompt) {
        collections.prompt.update(promptId, mutatePrompt)
      }

      if (promptFolderId && promptFolderModifiedAt) {
        collections.promptFolder.update(promptFolderId, (draft) => {
          draft.modifiedAt = promptFolderModifiedAt
        })
      }
    }
  })
}

export const upsertPromptDraft = (prompt: PromptFull): void => {
  upsertPromptDrafts([prompt])
}

export const upsertPromptSummaryDrafts = (prompts: PromptSummaryData[]): void => {
  if (prompts.length === 0) {
    return
  }

  const draftInserts: PromptDraftRecord[] = []
  const draftUpdatesById: Record<string, Pick<PromptSummaryData, 'title' | 'fallbackTitle'>> = {}
  const draftUpdateIds: string[] = []

  for (const prompt of prompts) {
    const existingRecord = promptDraftCollection.get(prompt.id)
    if (!existingRecord) {
      draftInserts.push(toPromptSummaryDraftSnapshot(prompt))
      continue
    }

    if (
      existingRecord.title === prompt.title &&
      existingRecord.fallbackTitle === prompt.fallbackTitle
    ) {
      continue
    }

    if (!draftUpdatesById[prompt.id]) {
      draftUpdateIds.push(prompt.id)
    }
    draftUpdatesById[prompt.id] = {
      title: prompt.title,
      fallbackTitle: prompt.fallbackTitle
    }
  }

  if (draftInserts.length > 0) {
    promptDraftCollection.insert(draftInserts)
  }

  if (draftUpdateIds.length > 0) {
    promptDraftCollection.update(draftUpdateIds, (draftRecords) => {
      for (const draftRecord of draftRecords) {
        const nextDraft = draftUpdatesById[draftRecord.id]
        if (!nextDraft) {
          continue
        }

        draftRecord.title = nextDraft.title
        draftRecord.fallbackTitle = nextDraft.fallbackTitle
      }
    })
  }
}

export const upsertPromptDrafts = (prompts: PromptFull[]): void => {
  if (prompts.length === 0) {
    return
  }

  const draftInserts: PromptDraftRecord[] = []
  const draftUpdatesById: Record<string, PromptDraftRecord> = {}
  const draftUpdateIds: string[] = []

  for (const prompt of prompts) {
    const promptSnapshot = toPromptSnapshot(prompt)
    const existingRecord = promptDraftCollection.get(prompt.id)

    if (!existingRecord) {
      clearPromptEditorMeasuredHeight(prompt.id)
      draftInserts.push(promptSnapshot)
      continue
    }

    if (haveSamePrompt(existingRecord, promptSnapshot)) {
      continue
    }

    if (existingRecord.promptText !== promptSnapshot.promptText) {
      clearPromptEditorMeasuredHeight(prompt.id)
    }

    if (!draftUpdatesById[prompt.id]) {
      draftUpdateIds.push(prompt.id)
    }
    draftUpdatesById[prompt.id] = promptSnapshot
  }

  if (draftInserts.length > 0) {
    promptDraftCollection.insert(draftInserts)
  }

  if (draftUpdateIds.length > 0) {
    promptDraftCollection.update(draftUpdateIds, (draftRecords) => {
      for (const draftRecord of draftRecords) {
        const nextSnapshot = draftUpdatesById[draftRecord.id]
        if (!nextSnapshot) {
          continue
        }

        Object.assign(draftRecord, nextSnapshot)
      }
    })
  }
}

export const getPromptDraftState = (promptId: string): PromptDraftState => {
  return promptDraftCollection.get(promptId)!
}

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
      if (draft.loadingState === 'full') {
        draft.modifiedAt = modifiedAt
      }
    },
    promptFolderModifiedAt: modifiedAt
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

  if (!textChanged) {
    return
  }

  const modifiedAt = getPromptDraftModifiedAt()
  mutatePromptDraftOptimistically(promptId, {
    mutatePromptDraft: (draft) => {
      draft.promptText = promptText
      draft.modifiedAt = modifiedAt
    },
    mutatePrompt: (draft) => {
      if (draft.loadingState === 'summary') {
        return
      }
      draft.promptText = promptText
      draft.modifiedAt = modifiedAt
    },
    promptFolderModifiedAt: modifiedAt
  })
}

export const flushPromptDraftAutosaves = async (): Promise<void> => {
  const tasks = promptDraftCollection.toArray.map(async (draftRecord) => {
    await submitPacedUpdateTransactionAndWait(promptCollection.id, draftRecord.id)
  })
  await Promise.allSettled(tasks)
}

export const deletePromptDrafts = (promptIds: string[]): void => {
  if (promptIds.length === 0) {
    return
  }

  clearPromptEditorMeasuredHeights(promptIds)
  promptDraftCollection.delete(promptIds)
}

export const removePromptDraft = (promptId: string): void => {
  deletePromptDrafts([promptId])
}

export const clearPromptDraftStore = (): void => {
  const draftIds = Array.from(promptDraftCollection.keys(), (draftId) => String(draftId))
  deletePromptDrafts(draftIds)
}
