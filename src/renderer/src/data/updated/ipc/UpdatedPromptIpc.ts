import type {
  Prompt,
  UpdatedCreatePromptRequest as CreatePromptRequest,
  UpdatedCreatePromptResult as CreatePromptResult,
  UpdatedPromptFolderData as PromptFolderData
} from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import {
  applyFetchPrompt,
  commitPromptDraftInsert,
  getPromptEntry,
  optimisticInsertPromptDraft,
  revertPromptDraftFromBase
} from '../UpdatedPromptDataStore.svelte.ts'
import {
  applyOptimisticUpdatedPromptFolder,
  getPromptFolderEntry,
  revertPromptFolderDraftFromBase
} from '../UpdatedPromptFolderDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import {
  enqueueMutationApplyOptimistic,
  type MutationOutcome
} from '../queues/UpdatedMutationsQueue'
import { runRefetch } from './UpdatedIpcHelpers'
import { refetchPromptFolderById } from './UpdatedPromptFolderIpc'

type PromptLoadResult = {
  data: Prompt
  revision: number
}

type CreatePromptSnapshot = {
  promptFolderId: string
  promptFolderRevision: number
  promptFolderData: PromptFolderData
  promptId: string
  promptData: Prompt
  previousPromptId: string | null
}

type CreatePromptResultData = {
  promptRevision: number
  promptFolderRevision: number
}

export const refetchPromptById = (promptId: string): Promise<void> =>
  runRefetch('prompt', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptLoadResult>('updated-load-prompt-by-id', { promptId })
    )
    applyFetchPrompt(promptId, result.data, result.revision)
  })

export const createPrompt = (
  promptFolderId: string,
  previousPromptId: string | null,
  title = '',
  promptText = ''
): Promise<MutationOutcome<CreatePromptResultData>> => {
  let promptId = ''

  return enqueueMutationApplyOptimistic<CreatePromptSnapshot, CreatePromptResultData>({
    optimisticMutation: () => {
      const promptFolderEntry = getPromptFolderEntry(promptFolderId)!
      const promptFolderDraft =
        promptFolderEntry.draftSnapshot ?? promptFolderEntry.baseSnapshot!.data
      const nextPromptCount = promptFolderDraft.promptCount + 1
      const now = new Date().toISOString()

      const promptDraft: Prompt = {
        id: '',
        title,
        creationDate: now,
        lastModifiedDate: now,
        promptText,
        promptFolderCount: nextPromptCount
      }

      promptId = optimisticInsertPromptDraft(promptDraft)
      const nextPromptIds = [...promptFolderDraft.promptIds]
      let insertIndex = nextPromptIds.length

      if (previousPromptId === null) {
        insertIndex = 0
      } else if (previousPromptId) {
        const previousIndex = nextPromptIds.indexOf(previousPromptId)
        if (previousIndex !== -1) {
          insertIndex = previousIndex + 1
        }
      }

      nextPromptIds.splice(insertIndex, 0, promptId)
      promptFolderEntry.draftSnapshot = {
        ...promptFolderDraft,
        promptCount: nextPromptCount,
        promptIds: nextPromptIds
      }
    },
    snapshot: () => {
      const promptFolderEntry = getPromptFolderEntry(promptFolderId)!
      const promptEntry = getPromptEntry(promptId)!

      // Clone draft state so later edits don't mutate the queued snapshot.
      return {
        promptFolderId,
        promptFolderRevision: promptFolderEntry.baseSnapshot!.revision,
        promptFolderData: structuredClone(
          promptFolderEntry.draftSnapshot ?? promptFolderEntry.baseSnapshot!.data
        ),
        promptId,
        promptData: structuredClone(promptEntry.draftSnapshot!),
        previousPromptId
      }
    },
    run: (snapshot) =>
      ipcInvoke<CreatePromptResult, CreatePromptRequest>('updated-create-prompt', {
        promptFolderId: snapshot.promptFolderId,
        promptFolderRevision: snapshot.promptFolderRevision,
        prompt: snapshot.promptData,
        previousPromptId: snapshot.previousPromptId
      }),
    commitSuccess: (result, snapshot) => {
      commitPromptDraftInsert(
        snapshot.promptId,
        snapshot.promptId,
        snapshot.promptData,
        result.data.promptRevision
      )
      applyOptimisticUpdatedPromptFolder(
        snapshot.promptFolderId,
        snapshot.promptFolderData,
        result.data.promptFolderRevision
      )
    },
    rollbackConflict: () => {
      revertPromptDraftFromBase(promptId)
      revertPromptFolderDraftFromBase(promptFolderId)
      void refetchPromptFolderById(promptFolderId)
    },
    rollbackError: () => {
      revertPromptDraftFromBase(promptId)
      revertPromptFolderDraftFromBase(promptFolderId)
    }
  })
}
