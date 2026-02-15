import type { Prompt } from '@shared/Prompt'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { SvelteMap } from 'svelte/reactivity'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  createPromptDraftMeasuredHeightKey,
  type PromptDraftRecord,
  promptDraftCollection
} from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedPromptAutosaveUpdate } from '../Mutations/PromptMutations'

export type PromptDraftState = PromptDraftRecord

const lastSyncedPromptsById = new SvelteMap<string, Prompt>()

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

const validatePromptDraftTransaction = (): boolean => {
  return true
}

type PromptDraftPacedUpdateOptions = Omit<
  Parameters<typeof mutatePacedPromptAutosaveUpdate>[0],
  'promptId' | 'debounceMs' | 'validateBeforeEnqueue'
>

const mutatePromptDraftPacedUpdate = (
  promptId: string,
  options: PromptDraftPacedUpdateOptions
): boolean => {
  return mutatePacedPromptAutosaveUpdate({
    promptId,
    debounceMs: AUTOSAVE_MS,
    validateBeforeEnqueue: validatePromptDraftTransaction,
    ...options
  })
}

const applyPromptMeasurementUpdate = (
  draftRecord: PromptDraftRecord,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  const key = createPromptDraftMeasuredHeightKey(
    measurement.widthPx,
    measurement.devicePixelRatio
  )

  if (textChanged) {
    if (measurement.measuredHeightPx == null) {
      draftRecord.promptEditorMeasuredHeightsByKey = {}
      return
    }

    draftRecord.promptEditorMeasuredHeightsByKey = {
      [key]: measurement.measuredHeightPx
    }
    return
  }

  if (measurement.measuredHeightPx == null) {
    return
  }

  draftRecord.promptEditorMeasuredHeightsByKey[key] = measurement.measuredHeightPx
}

export const syncPromptDraft = (prompt: Prompt): void => {
  syncPromptDrafts([prompt])
}

export const syncPromptDrafts = (
  prompts: Prompt[],
  options?: { createMissing?: boolean }
): void => {
  if (prompts.length === 0) {
    return
  }

  const createMissing = options?.createMissing ?? true
  const draftInserts: PromptDraftRecord[] = []
  const draftUpdates = new SvelteMap<string, Prompt>()

  for (const prompt of prompts) {
    const promptSnapshot = toPromptSnapshot(prompt)
    const existingRecord = promptDraftCollection.get(prompt.id)

    if (!existingRecord) {
      if (!createMissing) {
        continue
      }

      draftInserts.push({
        id: prompt.id,
        draftSnapshot: promptSnapshot,
        promptEditorMeasuredHeightsByKey: {}
      })
      lastSyncedPromptsById.set(prompt.id, promptSnapshot)
      continue
    }

    const lastSyncedPrompt = lastSyncedPromptsById.get(prompt.id)
    if (lastSyncedPrompt && haveSamePrompt(lastSyncedPrompt, promptSnapshot)) {
      continue
    }

    lastSyncedPromptsById.set(prompt.id, promptSnapshot)
    draftUpdates.set(prompt.id, promptSnapshot)
  }

  if (draftInserts.length > 0) {
    promptDraftCollection.insert(draftInserts)
  }

  if (draftUpdates.size > 0) {
    const draftUpdateIds = Array.from(draftUpdates.keys())
    promptDraftCollection.update(draftUpdateIds, (draftRecords) => {
      for (const draftRecord of draftRecords) {
        const nextSnapshot = draftUpdates.get(draftRecord.id)
        if (!nextSnapshot) {
          continue
        }

        draftRecord.draftSnapshot = nextSnapshot
      }
    })
  }
}

export const getPromptDraftState = (promptId: string): PromptDraftState | null => {
  return promptDraftCollection.get(promptId) ?? null
}

export const setPromptDraftTitle = (promptId: string, title: string): void => {
  const draftRecord = promptDraftCollection.get(promptId)
  if (!draftRecord || draftRecord.draftSnapshot.title === title) {
    return
  }

  mutatePromptDraftPacedUpdate(promptId, {
    mutateOptimistically: ({ collections }) => {
      collections.promptDraft.update(promptId, (draft) => {
        draft.draftSnapshot.title = title
      })

      collections.prompt.update(promptId, (draft) => {
        draft.title = title
      })
    }
  })
}

export const setPromptDraftText = (
  promptId: string,
  promptText: string,
  measurement: TextMeasurement
): void => {
  const draftRecord = promptDraftCollection.get(promptId)
  if (!draftRecord) {
    return
  }

  const textChanged = draftRecord.draftSnapshot.promptText !== promptText

  if (!textChanged) {
    const updatedOpenTransaction = mutatePromptDraftPacedUpdate(promptId, {
      draftOnlyChange: true,
      mutateOptimistically: ({ collections }) => {
        collections.promptDraft.update(promptId, (draft) => {
          applyPromptMeasurementUpdate(draft, measurement, false)
        })
      }
    })

    if (!updatedOpenTransaction) {
      promptDraftCollection.update(promptId, (draft) => {
        applyPromptMeasurementUpdate(draft, measurement, false)
      })
    }

    return
  }

  mutatePromptDraftPacedUpdate(promptId, {
    mutateOptimistically: ({ collections }) => {
      collections.promptDraft.update(promptId, (draft) => {
        draft.draftSnapshot.promptText = promptText
        applyPromptMeasurementUpdate(draft, measurement, true)
      })

      collections.prompt.update(promptId, (draft) => {
        draft.promptText = promptText
      })
    }
  })
}

export const flushPromptDraftAutosaves = async (): Promise<void> => {
  const tasks = promptDraftCollection.toArray.map(async (draftRecord) => {
    await submitPacedUpdateTransactionAndWait(promptCollection.id, draftRecord.id)
  })
  await Promise.allSettled(tasks)
}

export const removePromptDraft = (promptId: string): void => {
  promptDraftCollection.delete(promptId)
  lastSyncedPromptsById.delete(promptId)
}

export const clearPromptDraftStore = (): void => {
  const draftIds = Array.from(promptDraftCollection.keys())
  if (draftIds.length > 0) {
    promptDraftCollection.delete(draftIds)
  }
  lastSyncedPromptsById.clear()
}
