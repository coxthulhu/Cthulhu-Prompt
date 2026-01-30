import type {
  Prompt,
  UpdatedCreatePromptFolderRequest,
  UpdatedCreatePromptFolderResult,
  UpdatedPromptFolderData,
  UpdatedWorkspaceData
} from '@shared/ipc'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { applyFetchUpdatedPrompt } from '../UpdatedPromptDataStore.svelte.ts'
import {
  applyFetchUpdatedPromptFolder,
  commitUpdatedPromptFolderDraftInsert,
  getUpdatedPromptFolderEntry,
  optimisticInsertUpdatedPromptFolderDraft,
  revertUpdatedPromptFolderDraftFromBase
} from '../UpdatedPromptFolderDataStore.svelte.ts'
import {
  applyOptimisticUpdatedWorkspace,
  getUpdatedWorkspaceEntry,
  revertUpdatedWorkspaceDraftFromBase
} from '../UpdatedWorkspaceDataStore.svelte.ts'
import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import {
  enqueueMutationApplyOptimistic,
  type UpdatedMutationOutcome
} from '../queues/UpdatedMutationsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'
import { refetchUpdatedWorkspaceById } from './workspaceIpc'

type UpdatedPromptFolderLoadResult = {
  data: UpdatedPromptFolderData
  revision: number
}

type UpdatedPromptFolderInitialLoadResult = {
  promptFolder: { data: UpdatedPromptFolderData; revision: number }
  prompts: Array<{ data: Prompt; revision: number }>
}

type UpdatedCreatePromptFolderSnapshot = {
  workspaceId: string
  workspaceRevision: number
  promptFolderId: string
  workspaceData: UpdatedWorkspaceData
  promptFolderData: UpdatedPromptFolderData
}

type UpdatedCreatePromptFolderResultData = {
  workspaceRevision: number
  promptFolderRevision: number
}

export const refetchUpdatedPromptFolderById = (promptFolderId: string): Promise<void> =>
  runUpdatedRefetch('prompt folder', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptFolderLoadResult>('updated-load-prompt-folder-by-id', {
        promptFolderId
      })
    )
    applyFetchUpdatedPromptFolder(promptFolderId, result.data, result.revision)
  })

export const loadUpdatedPromptFolderInitial = (promptFolderId: string): Promise<void> =>
  runUpdatedRefetch('prompt folder initial load', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptFolderInitialLoadResult>('updated-load-prompt-folder-initial', {
        promptFolderId
      })
    )

    applyFetchUpdatedPromptFolder(
      promptFolderId,
      result.promptFolder.data,
      result.promptFolder.revision
    )

    for (const prompt of result.prompts) {
      applyFetchUpdatedPrompt(prompt.data.id, prompt.data, prompt.revision)
    }
  })

export const createUpdatedPromptFolder = (
  workspaceId: string,
  displayName: string
): Promise<UpdatedMutationOutcome<UpdatedCreatePromptFolderResultData>> => {
  const preparedName = preparePromptFolderName(displayName)
  let promptFolderId = ''

  return enqueueMutationApplyOptimistic<
    UpdatedCreatePromptFolderSnapshot,
    UpdatedCreatePromptFolderResultData
  >(
    {
      optimisticMutation: () => {
        const workspaceEntry = getUpdatedWorkspaceEntry(workspaceId)!
        const workspaceDraft =
          workspaceEntry.draftSnapshot ?? workspaceEntry.baseSnapshot!.data
        const promptFolderDraft: UpdatedPromptFolderData = {
          promptFolderId: '',
          folderName: preparedName.folderName,
          displayName: preparedName.displayName,
          promptCount: 0,
          folderDescription: ''
        }

        promptFolderId = optimisticInsertUpdatedPromptFolderDraft(promptFolderDraft)
        workspaceEntry.draftSnapshot = {
          ...workspaceDraft,
          promptFolderIds: [...workspaceDraft.promptFolderIds, promptFolderId]
        }
      },
      snapshot: () => {
        const workspaceEntry = getUpdatedWorkspaceEntry(workspaceId)!
        const promptFolderEntry = getUpdatedPromptFolderEntry(promptFolderId)!

        // Clone draft state so later edits don't mutate the queued snapshot.
        return {
          workspaceId,
          workspaceRevision: workspaceEntry.baseSnapshot!.revision,
          promptFolderId,
          workspaceData: structuredClone(
            workspaceEntry.draftSnapshot ?? workspaceEntry.baseSnapshot!.data
          ),
          promptFolderData: structuredClone(promptFolderEntry.draftSnapshot!)
        }
      },
      run: (snapshot) =>
        ipcInvoke<UpdatedCreatePromptFolderResult, UpdatedCreatePromptFolderRequest>(
          'updated-create-prompt-folder',
          {
            workspaceId: snapshot.workspaceId,
            workspaceRevision: snapshot.workspaceRevision,
            promptFolder: snapshot.promptFolderData
          }
        ),
      commitSuccess: (result, snapshot) => {
        commitUpdatedPromptFolderDraftInsert(
          snapshot.promptFolderId,
          snapshot.promptFolderId,
          snapshot.promptFolderData,
          result.data.promptFolderRevision
        )
        applyOptimisticUpdatedWorkspace(
          snapshot.workspaceId,
          snapshot.workspaceData,
          result.data.workspaceRevision
        )
      },
      rollbackConflict: () => {
        revertUpdatedPromptFolderDraftFromBase(promptFolderId)
        revertUpdatedWorkspaceDraftFromBase(workspaceId)
        void refetchUpdatedWorkspaceById(workspaceId)
      },
      rollbackError: () => {
        revertUpdatedPromptFolderDraftFromBase(promptFolderId)
        revertUpdatedWorkspaceDraftFromBase(workspaceId)
      }
    }
  )
}
