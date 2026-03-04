import type { PromptUiState } from '@shared/PromptUiState'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  type PromptUiStateDraftRecord,
  promptUiStateDraftCollection
} from '../Collections/PromptUiStateDraftCollection'
import { promptUiStateCollection } from '../Collections/PromptUiStateCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedPromptUiStateAutosaveUpdate } from '../Mutations/PromptUiStateMutations'

export const upsertPromptUiStateDraft = (promptUiState: PromptUiState): void => {
  upsertPromptUiStateDrafts([promptUiState])
}

export const upsertPromptUiStateDrafts = (promptUiStates: PromptUiState[]): void => {
  if (promptUiStates.length === 0) {
    return
  }

  const inserts: PromptUiStateDraftRecord[] = []
  const updatesById: Record<string, PromptUiState> = {}
  const updateIds: string[] = []

  for (const promptUiState of promptUiStates) {
    const existingRecord = promptUiStateDraftCollection.get(promptUiState.promptId)

    if (!existingRecord) {
      inserts.push(promptUiState)
      continue
    }

    if (
      existingRecord.workspaceId === promptUiState.workspaceId &&
      existingRecord.editorViewStateJson === promptUiState.editorViewStateJson
    ) {
      continue
    }

    if (!updatesById[promptUiState.promptId]) {
      updateIds.push(promptUiState.promptId)
    }
    updatesById[promptUiState.promptId] = promptUiState
  }

  if (inserts.length > 0) {
    promptUiStateDraftCollection.insert(inserts)
  }

  if (updateIds.length > 0) {
    promptUiStateDraftCollection.update(updateIds, (records) => {
      for (const record of records) {
        const next = updatesById[record.promptId]
        if (!next) {
          continue
        }

        record.workspaceId = next.workspaceId
        record.promptId = next.promptId
        record.editorViewStateJson = next.editorViewStateJson
      }
    })
  }
}

export const lookupPromptEditorViewStateJson = (promptId: string): string | null => {
  return promptUiStateDraftCollection.get(promptId)?.editorViewStateJson ?? null
}

export const setPromptEditorViewStateJson = (
  workspaceId: string,
  promptId: string,
  editorViewStateJson: string | null
): void => {
  if (editorViewStateJson === null) {
    return
  }

  const existingDraft = promptUiStateDraftCollection.get(promptId)
  if (
    existingDraft &&
    existingDraft.workspaceId === workspaceId &&
    existingDraft.editorViewStateJson === editorViewStateJson
  ) {
    return
  }

  mutatePacedPromptUiStateAutosaveUpdate({
    promptId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      const nextPromptUiState: PromptUiState = {
        workspaceId,
        promptId,
        editorViewStateJson
      }

      if (promptUiStateCollection.get(promptId)) {
        collections.promptUiState.update(promptId, (draft) => {
          draft.workspaceId = nextPromptUiState.workspaceId
          draft.promptId = nextPromptUiState.promptId
          draft.editorViewStateJson = nextPromptUiState.editorViewStateJson
        })
      } else {
        collections.promptUiState.insert(nextPromptUiState)
      }

      if (promptUiStateDraftCollection.get(promptId)) {
        collections.promptUiStateDraft.update(promptId, (draft) => {
          draft.workspaceId = nextPromptUiState.workspaceId
          draft.promptId = nextPromptUiState.promptId
          draft.editorViewStateJson = nextPromptUiState.editorViewStateJson
        })
      } else {
        collections.promptUiStateDraft.insert(nextPromptUiState)
      }
    }
  })
}

export const deletePromptUiStates = (promptIds: string[]): void => {
  if (promptIds.length === 0) {
    return
  }

  promptUiStateCollection.utils.deleteManyAuthoritative(promptIds)
  promptUiStateDraftCollection.delete(promptIds)
}

export const removePromptUiState = (promptId: string): void => {
  deletePromptUiStates([promptId])
}

export const flushPromptUiStateAutosaves = async (): Promise<void> => {
  const tasks = promptUiStateDraftCollection.toArray.map(async (draftRecord) => {
    await submitPacedUpdateTransactionAndWait(promptUiStateCollection.id, draftRecord.promptId)
  })

  await Promise.allSettled(tasks)
}

export const clearPromptUiStateStore = (): void => {
  const promptIds = Array.from(promptUiStateDraftCollection.keys(), (promptId) => String(promptId))
  deletePromptUiStates(promptIds)
}
