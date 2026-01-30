import type {
  Prompt,
  UpdatedCreatePromptRequest,
  UpdatedCreatePromptResult,
  UpdatedPromptFolderData
} from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import {
  applyFetchUpdatedPrompt,
  commitUpdatedPromptDraftInsert,
  getUpdatedPromptEntry,
  optimisticInsertUpdatedPromptDraft,
  revertUpdatedPromptDraftFromBase
} from '../UpdatedPromptDataStore.svelte.ts'
import {
  applyOptimisticUpdatedPromptFolder,
  getUpdatedPromptFolderEntry,
  revertUpdatedPromptFolderDraftFromBase
} from '../UpdatedPromptFolderDataStore.svelte.ts'
import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import {
  enqueueMutationApplyOptimistic,
  type UpdatedMutationOutcome
} from '../queues/UpdatedMutationsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'
import { refetchUpdatedPromptFolderById } from './promptFolderIpc'

type UpdatedPromptLoadResult = {
  data: Prompt
  revision: number
}

type UpdatedCreatePromptSnapshot = {
  promptFolderId: string
  promptFolderRevision: number
  promptFolderData: UpdatedPromptFolderData
  promptId: string
  promptData: Prompt
  previousPromptId: string | null
}

type UpdatedCreatePromptResultData = {
  promptRevision: number
  promptFolderRevision: number
}

export const refetchUpdatedPromptById = (promptId: string): Promise<void> =>
  runUpdatedRefetch('prompt', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptLoadResult>('updated-load-prompt-by-id', { promptId })
    )
    applyFetchUpdatedPrompt(promptId, result.data, result.revision)
  })

export const createUpdatedPrompt = (
  promptFolderId: string,
  previousPromptId: string | null,
  title = '',
  promptText = ''
): Promise<UpdatedMutationOutcome<UpdatedCreatePromptResultData>> => {
  let promptId = ''

  return enqueueMutationApplyOptimistic<UpdatedCreatePromptSnapshot, UpdatedCreatePromptResultData>({
    optimisticMutation: () => {
      const promptFolderEntry = getUpdatedPromptFolderEntry(promptFolderId)!
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

      promptId = optimisticInsertUpdatedPromptDraft(promptDraft)
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
      const promptFolderEntry = getUpdatedPromptFolderEntry(promptFolderId)!
      const promptEntry = getUpdatedPromptEntry(promptId)!

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
      ipcInvoke<UpdatedCreatePromptResult, UpdatedCreatePromptRequest>('updated-create-prompt', {
        promptFolderId: snapshot.promptFolderId,
        promptFolderRevision: snapshot.promptFolderRevision,
        prompt: snapshot.promptData,
        previousPromptId: snapshot.previousPromptId
      }),
    commitSuccess: (result, snapshot) => {
      commitUpdatedPromptDraftInsert(
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
      revertUpdatedPromptDraftFromBase(promptId)
      revertUpdatedPromptFolderDraftFromBase(promptFolderId)
      void refetchUpdatedPromptFolderById(promptFolderId)
    },
    rollbackError: () => {
      revertUpdatedPromptDraftFromBase(promptId)
      revertUpdatedPromptFolderDraftFromBase(promptFolderId)
    }
  })
}
