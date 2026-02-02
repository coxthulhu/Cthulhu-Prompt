import type {
  ResponseData,
  UpdatedCreatePromptFolderPayload,
  UpdatedCreatePromptFolderRequest,
  UpdatedCreatePromptFolderResult,
  UpdatedPromptData as PromptData,
  UpdatedPromptFolderData as PromptFolderData
} from '@shared/ipc/updatedTypes'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { mergeAuthoritativePromptSnapshot } from '../UpdatedPromptDataStore.svelte.ts'
import {
  getPromptFolderEntry,
  mergeAuthoritativePromptFolderSnapshot,
  optimisticDeletePromptFolderDraft,
  optimisticInsertPromptFolderDraft,
  rekeyPromptFolderEntry
} from '../UpdatedPromptFolderDataStore.svelte.ts'
import {
  getWorkspaceEntry,
  mergeAuthoritativeWorkspaceSnapshot
} from '../UpdatedWorkspaceDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { enqueueMutationApplyOptimistic } from '../queues/UpdatedMutationsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type PromptFolderLoadResult = ResponseData<PromptFolderData>

type PromptFolderInitialLoadResult = {
  promptFolder: ResponseData<PromptFolderData>
  prompts: Array<ResponseData<PromptData>>
}

type CreatePromptFolderSnapshot = {
  workspaceId: string
  expectedRevision: number
  displayName: string
  clientTempId: string
}

const insertPromptFolderIdByName = (
  promptFolderIds: string[],
  promptFolderId: string,
  folderName: string
): string[] => {
  const nextIds = [...promptFolderIds]
  let insertIndex = nextIds.length

  for (let index = 0; index < promptFolderIds.length; index += 1) {
    const existingId = promptFolderIds[index]
    const entry = getPromptFolderEntry(existingId)!
    const entryData = entry.draftSnapshot ?? entry.lastServerSnapshot!.data

    if (entryData.folderName.localeCompare(folderName) > 0) {
      insertIndex = index
      break
    }
  }

  nextIds.splice(insertIndex, 0, promptFolderId)
  return nextIds
}

export const refetchPromptFolderById = (promptFolderId: string): Promise<void> =>
  runRefetch('prompt folder', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptFolderLoadResult>('updated-load-prompt-folder-by-id', {
        id: promptFolderId
      })
    )
    mergeAuthoritativePromptFolderSnapshot(result)
  })

export const loadPromptFolderInitial = (promptFolderId: string): Promise<void> =>
  runRefetch('prompt folder initial load', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptFolderInitialLoadResult>('updated-load-prompt-folder-initial', {
        id: promptFolderId
      })
    )

    mergeAuthoritativePromptFolderSnapshot(result.promptFolder)

    for (const prompt of result.prompts) {
      mergeAuthoritativePromptSnapshot(prompt)
    }
  })

export const createPromptFolder = async (
  workspaceId: string,
  displayName: string
): Promise<PromptFolderData | null> => {
  const workspaceEntry = getWorkspaceEntry(workspaceId)

  if (!workspaceEntry?.draftSnapshot || !workspaceEntry.lastServerSnapshot) {
    return null
  }

  const { displayName: normalizedDisplayName, folderName } =
    preparePromptFolderName(displayName)
  let optimisticPromptFolderId = ''
  let previousPromptFolderIds: string[] = []

  const outcome = await enqueueMutationApplyOptimistic<
    CreatePromptFolderSnapshot,
    UpdatedCreatePromptFolderPayload
  >({
    optimisticMutation: () => {
      const promptFolderDraft: PromptFolderData = {
        folderName,
        displayName: normalizedDisplayName,
        promptCount: 0,
        promptIds: [],
        folderDescription: ''
      }

      optimisticPromptFolderId = optimisticInsertPromptFolderDraft(promptFolderDraft)
      previousPromptFolderIds = [...workspaceEntry.draftSnapshot!.promptFolderIds]
      workspaceEntry.draftSnapshot!.promptFolderIds = insertPromptFolderIdByName(
        workspaceEntry.draftSnapshot!.promptFolderIds,
        optimisticPromptFolderId,
        folderName
      )
    },
    snapshot: () => ({
      // Side effect: capture the workspace and temp ID that the optimistic insert touched.
      // This keeps commit/rollback aligned if the user navigates to another workspace.
      workspaceId,
      expectedRevision: workspaceEntry.lastServerSnapshot!.revision,
      displayName: normalizedDisplayName,
      clientTempId: optimisticPromptFolderId
    }),
    run: (snapshot, requestId) =>
      ipcInvoke<UpdatedCreatePromptFolderResult, UpdatedCreatePromptFolderRequest>(
        'updated-create-prompt-folder',
        {
          requestId,
          payload: {
            data: {
              workspaceId: snapshot.workspaceId,
              displayName: snapshot.displayName,
              clientTempId: snapshot.clientTempId
            },
            expectedRevision: snapshot.expectedRevision
          }
        }
      ),
    commitSuccess: (result, snapshot) => {
      const promptFolderResponse = result.payload.promptFolder!

      rekeyPromptFolderEntry(promptFolderResponse, (oldId, newId) => {
        // Side effect: rekey the optimistic entry on the same workspace that queued the mutation.
        // The snapshot's workspaceId anchors the rewrite even if the active workspace changes.
        const entry = getWorkspaceEntry(snapshot.workspaceId)
        if (!entry?.draftSnapshot) {
          return
        }

        const rewriteIds = (ids: string[]) => ids.map((id) => (id === oldId ? newId : id))
        entry.draftSnapshot.promptFolderIds = rewriteIds(entry.draftSnapshot.promptFolderIds)

        if (entry.lastServerSnapshot) {
          entry.lastServerSnapshot.data.promptFolderIds = rewriteIds(
            entry.lastServerSnapshot.data.promptFolderIds
          )
        }
      })

      mergeAuthoritativePromptFolderSnapshot(promptFolderResponse)
      mergeAuthoritativeWorkspaceSnapshot(result.payload.workspace)
    },
    rollbackConflict: (result) => {
      optimisticDeletePromptFolderDraft(optimisticPromptFolderId)
      mergeAuthoritativeWorkspaceSnapshot(result.payload.workspace, true)
    },
    rollbackError: () => {
      // Side effect: only revert the optimistic insert for this mutation.
      // We keep other draft edits intact instead of resetting to the last server snapshot.
      optimisticDeletePromptFolderDraft(optimisticPromptFolderId)
      workspaceEntry.draftSnapshot!.promptFolderIds = previousPromptFolderIds
    }
  })

  if (outcome.type !== 'success') {
    return null
  }

  return outcome.result.payload.promptFolder?.data ?? null
}
