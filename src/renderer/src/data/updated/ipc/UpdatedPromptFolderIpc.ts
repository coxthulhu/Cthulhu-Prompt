import type {
  Prompt,
  UpdatedCreatePromptFolderRequest as CreatePromptFolderRequest,
  UpdatedCreatePromptFolderResult as CreatePromptFolderResult,
  UpdatedPromptFolderData as PromptFolderData,
  UpdatedWorkspaceData as WorkspaceData
} from '@shared/ipc'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { applyFetchPrompt } from '../UpdatedPromptDataStore.svelte.ts'
import {
  applyFetchPromptFolder,
  commitPromptFolderDraftInsert,
  getPromptFolderEntry,
  optimisticInsertPromptFolderDraft,
  revertPromptFolderDraftFromBase
} from '../UpdatedPromptFolderDataStore.svelte.ts'
import {
  applyOptimisticUpdatedWorkspace,
  getWorkspaceEntry,
  revertWorkspaceDraftFromBase
} from '../UpdatedWorkspaceDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import {
  enqueueMutationApplyOptimistic,
  type MutationOutcome
} from '../queues/UpdatedMutationsQueue'
import { runRefetch } from './UpdatedIpcHelpers'
import { refetchWorkspaceById } from './UpdatedWorkspaceIpc'

type PromptFolderLoadResult = {
  data: PromptFolderData
  revision: number
}

type PromptFolderInitialLoadResult = {
  promptFolder: { data: PromptFolderData; revision: number }
  prompts: Array<{ data: Prompt; revision: number }>
}

type CreatePromptFolderSnapshot = {
  workspaceId: string
  workspaceRevision: number
  promptFolderId: string
  workspaceData: WorkspaceData
  promptFolderData: PromptFolderData
}

type CreatePromptFolderResultData = {
  workspaceRevision: number
  promptFolderRevision: number
}

export const refetchPromptFolderById = (promptFolderId: string): Promise<void> =>
  runRefetch('prompt folder', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptFolderLoadResult>('updated-load-prompt-folder-by-id', {
        promptFolderId
      })
    )
    applyFetchPromptFolder(promptFolderId, result.data, result.revision)
  })

export const loadPromptFolderInitial = (promptFolderId: string): Promise<void> =>
  runRefetch('prompt folder initial load', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptFolderInitialLoadResult>('updated-load-prompt-folder-initial', {
        promptFolderId
      })
    )

    applyFetchPromptFolder(
      promptFolderId,
      result.promptFolder.data,
      result.promptFolder.revision
    )

    for (const prompt of result.prompts) {
      applyFetchPrompt(prompt.data.id, prompt.data, prompt.revision)
    }
  })

export const createPromptFolder = (
  workspaceId: string,
  displayName: string
): Promise<MutationOutcome<CreatePromptFolderResultData>> => {
  const preparedName = preparePromptFolderName(displayName)
  let promptFolderId = ''

  return enqueueMutationApplyOptimistic<
    CreatePromptFolderSnapshot,
    CreatePromptFolderResultData
  >(
    {
      optimisticMutation: () => {
        const workspaceEntry = getWorkspaceEntry(workspaceId)!
        const workspaceDraft =
          workspaceEntry.draftSnapshot ?? workspaceEntry.baseSnapshot!.data
        const promptFolderDraft: PromptFolderData = {
          promptFolderId: '',
          folderName: preparedName.folderName,
          displayName: preparedName.displayName,
          promptCount: 0,
          promptIds: [],
          folderDescription: ''
        }

        promptFolderId = optimisticInsertPromptFolderDraft(promptFolderDraft)
        workspaceEntry.draftSnapshot = {
          ...workspaceDraft,
          promptFolderIds: [...workspaceDraft.promptFolderIds, promptFolderId]
        }
      },
      snapshot: () => {
        const workspaceEntry = getWorkspaceEntry(workspaceId)!
        const promptFolderEntry = getPromptFolderEntry(promptFolderId)!

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
        ipcInvoke<CreatePromptFolderResult, CreatePromptFolderRequest>(
          'updated-create-prompt-folder',
          {
            workspaceId: snapshot.workspaceId,
            workspaceRevision: snapshot.workspaceRevision,
            promptFolder: snapshot.promptFolderData
          }
        ),
      commitSuccess: (result, snapshot) => {
        commitPromptFolderDraftInsert(
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
        revertPromptFolderDraftFromBase(promptFolderId)
        revertWorkspaceDraftFromBase(workspaceId)
        void refetchWorkspaceById(workspaceId)
      },
      rollbackError: () => {
        revertPromptFolderDraftFromBase(promptFolderId)
        revertWorkspaceDraftFromBase(workspaceId)
      }
    }
  )
}
