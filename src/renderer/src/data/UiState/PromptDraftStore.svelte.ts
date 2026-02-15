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

type PromptDraftOptimisticMutationOptions = {
  draftOnlyChange?: boolean
  mutatePromptDraft: (draft: PromptDraftRecord) => void
  mutatePrompt?: (draft: Prompt) => void
}

const mutatePromptDraftOptimistically = (
  promptId: string,
  options: PromptDraftOptimisticMutationOptions
): boolean => {
  const { draftOnlyChange, mutatePromptDraft, mutatePrompt } = options

  return mutatePacedPromptAutosaveUpdate({
    promptId,
    debounceMs: AUTOSAVE_MS,
    draftOnlyChange,
    mutateOptimistically: ({ collections }) => {
      collections.promptDraft.update(promptId, mutatePromptDraft)

      if (mutatePrompt) {
        collections.prompt.update(promptId, mutatePrompt)
      }
    }
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
  const draftUpdatesById: Record<string, Prompt> = {}
  const draftUpdateIds: string[] = []

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

  mutatePromptDraftOptimistically(promptId, {
    mutatePromptDraft: (draft) => {
      draft.draftSnapshot.title = title
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
  const draftRecord = promptDraftCollection.get(promptId)
  if (!draftRecord) {
    return
  }

  const textChanged = draftRecord.draftSnapshot.promptText !== promptText

  if (!textChanged) {
    const didUpdateOpenTransaction = mutatePromptDraftOptimistically(promptId, {
      draftOnlyChange: true,
      mutatePromptDraft: (draft) => {
        applyPromptMeasurementUpdate(draft, measurement, false)
      }
    })

    if (!didUpdateOpenTransaction) {
      promptDraftCollection.update(promptId, (draft) => {
        applyPromptMeasurementUpdate(draft, measurement, false)
      })
    }

    return
  }

  mutatePromptDraftOptimistically(promptId, {
    mutatePromptDraft: (draft) => {
      draft.draftSnapshot.promptText = promptText
      applyPromptMeasurementUpdate(draft, measurement, true)
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
