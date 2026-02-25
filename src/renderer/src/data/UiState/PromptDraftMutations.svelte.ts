import type { Prompt } from '@shared/Prompt'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { type PromptDraftRecord, promptDraftCollection } from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedPromptAutosaveUpdate } from '../Mutations/PromptMutations'
import {
  clearPromptEditorMeasuredHeight,
  clearPromptEditorMeasuredHeights,
  recordPromptEditorMeasuredHeight
} from './PromptDraftUiCache.svelte.ts'

export type PromptDraftState = PromptDraftRecord

const toPromptSnapshot = (prompt: Prompt): Prompt => ({
  id: prompt.id,
  title: prompt.title,
  creationDate: prompt.creationDate,
  lastModifiedDate: prompt.lastModifiedDate,
  promptText: prompt.promptText,
  promptFolderCount: prompt.promptFolderCount
})

const haveSamePrompt = (left: Prompt, right: Prompt): boolean => {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.creationDate === right.creationDate &&
    left.lastModifiedDate === right.lastModifiedDate &&
    left.promptText === right.promptText &&
    left.promptFolderCount === right.promptFolderCount
  )
}

type PromptDraftOptimisticMutationOptions = {
  mutatePromptDraft: (draft: PromptDraftRecord) => void
  mutatePrompt?: (draft: Prompt) => void
}

const mutatePromptDraftOptimistically = (
  promptId: string,
  options: PromptDraftOptimisticMutationOptions
): void => {
  const { mutatePromptDraft, mutatePrompt } = options

  mutatePacedPromptAutosaveUpdate({
    promptId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.promptDraft.update(promptId, mutatePromptDraft)

      if (mutatePrompt) {
        collections.prompt.update(promptId, mutatePrompt)
      }
    }
  })
}

export const upsertPromptDraft = (prompt: Prompt): void => {
  upsertPromptDrafts([prompt])
}

export const upsertPromptDrafts = (prompts: Prompt[]): void => {
  if (prompts.length === 0) {
    return
  }

  const draftInserts: PromptDraftRecord[] = []
  const draftUpdatesById: Record<string, Prompt> = {}
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
  if (draftRecord.title === title) {
    return
  }

  mutatePromptDraftOptimistically(promptId, {
    mutatePromptDraft: (draft) => {
      draft.title = title
    },
    mutatePrompt: (draft) => {
      draft.title = title
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

  if (!textChanged) {
    return
  }

  mutatePromptDraftOptimistically(promptId, {
    mutatePromptDraft: (draft) => {
      draft.promptText = promptText
    },
    mutatePrompt: (draft) => {
      draft.promptText = promptText
    }
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
