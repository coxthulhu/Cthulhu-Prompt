import type {
  ResponseData,
  UpdatedCreatePromptPayload,
  UpdatedCreatePromptRequest,
  UpdatedCreatePromptResult,
  UpdatedPromptData as PromptData
} from '@shared/ipc/updatedTypes'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import {
  mergeAuthoritativePromptSnapshot,
  optimisticDeletePromptDraft,
  optimisticInsertPromptDraft,
  rekeyPromptEntry
} from '../UpdatedPromptDataStore.svelte.ts'
import {
  getPromptFolderEntry,
  mergeAuthoritativePromptFolderSnapshot
} from '../UpdatedPromptFolderDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { enqueueMutationApplyOptimistic } from '../queues/UpdatedMutationsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type PromptLoadResult = ResponseData<PromptData>

type CreatePromptSnapshot = {
  promptFolderId: string
  expectedRevision: number
  title: string
  promptText: string
  insertAfterPromptId: string | null
  clientTempId: string
}

export const refetchPromptById = (promptId: string): Promise<void> =>
  runRefetch('prompt', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptLoadResult>('updated-load-prompt-by-id', { id: promptId })
    )
    mergeAuthoritativePromptSnapshot(result)
  })

export const createPrompt = async (
  promptFolderId: string,
  title: string,
  promptText: string,
  insertAfterPromptId: string | null
): Promise<PromptData | null> => {
  const promptFolderEntry = getPromptFolderEntry(promptFolderId)

  if (!promptFolderEntry?.draftSnapshot || !promptFolderEntry.lastServerSnapshot) {
    return null
  }

  let optimisticPromptId = ''
  let previousPromptIds: string[] = []
  let previousPromptCount = 0

  const outcome = await enqueueMutationApplyOptimistic<
    CreatePromptSnapshot,
    UpdatedCreatePromptPayload
  >({
    optimisticMutation: () => {
      const now = new Date().toISOString()
      const promptFolderDraft = promptFolderEntry.draftSnapshot!

      previousPromptIds = [...promptFolderDraft.promptIds]
      previousPromptCount = promptFolderDraft.promptCount

      const nextPromptCount = previousPromptCount + 1
      const promptDraft: PromptData = {
        title,
        creationDate: now,
        lastModifiedDate: now,
        promptText,
        promptFolderCount: nextPromptCount
      }

      optimisticPromptId = optimisticInsertPromptDraft(promptDraft)

      let insertIndex = previousPromptIds.length
      if (insertAfterPromptId === null) {
        insertIndex = 0
      } else {
        const previousIndex = previousPromptIds.indexOf(insertAfterPromptId)
        if (previousIndex !== -1) {
          insertIndex = previousIndex + 1
        }
      }

      const nextPromptIds = [...previousPromptIds]
      nextPromptIds.splice(insertIndex, 0, optimisticPromptId)
      promptFolderDraft.promptIds = nextPromptIds
      promptFolderDraft.promptCount = nextPromptCount
    },
    snapshot: () => ({
      // Side effect: capture the folder and temp ID that the optimistic insert touched.
      // This keeps commit/rollback aligned if the user switches folders.
      promptFolderId,
      expectedRevision: promptFolderEntry.lastServerSnapshot!.revision,
      title,
      promptText,
      insertAfterPromptId,
      clientTempId: optimisticPromptId
    }),
    run: (snapshot, requestId) =>
      ipcInvoke<UpdatedCreatePromptResult, UpdatedCreatePromptRequest>(
        'updated-create-prompt',
        {
          requestId,
          payload: {
            data: {
              promptFolderId: snapshot.promptFolderId,
              title: snapshot.title,
              promptText: snapshot.promptText,
              insertAfterPromptId: snapshot.insertAfterPromptId,
              clientTempId: snapshot.clientTempId
            },
            expectedRevision: snapshot.expectedRevision
          }
        }
      ),
    commitSuccess: (result, snapshot) => {
      const promptResponse = result.payload.prompt!

      rekeyPromptEntry(promptResponse, (oldId, newId) => {
        // Side effect: rekey the optimistic entry on the same folder that queued the mutation.
        // The snapshot's promptFolderId anchors the rewrite even if the active folder changes.
        const entry = getPromptFolderEntry(snapshot.promptFolderId)
        if (!entry?.draftSnapshot) {
          return
        }

        const rewriteIds = (ids: string[]) => ids.map((id) => (id === oldId ? newId : id))
        entry.draftSnapshot.promptIds = rewriteIds(entry.draftSnapshot.promptIds)

        if (entry.lastServerSnapshot) {
          entry.lastServerSnapshot.data.promptIds = rewriteIds(
            entry.lastServerSnapshot.data.promptIds
          )
        }
      })

      mergeAuthoritativePromptSnapshot(promptResponse)
      mergeAuthoritativePromptFolderSnapshot(result.payload.promptFolder)
    },
    rollbackConflict: (result) => {
      optimisticDeletePromptDraft(optimisticPromptId)
      mergeAuthoritativePromptFolderSnapshot(result.payload.promptFolder, true)
    },
    rollbackError: () => {
      // Side effect: only revert the optimistic insert for this mutation.
      // We keep other draft edits intact instead of resetting to the last server snapshot.
      optimisticDeletePromptDraft(optimisticPromptId)
      promptFolderEntry.draftSnapshot!.promptIds = previousPromptIds
      promptFolderEntry.draftSnapshot!.promptCount = previousPromptCount
    }
  })

  if (outcome.type !== 'success') {
    return null
  }

  return outcome.result.payload.prompt?.data ?? null
}
