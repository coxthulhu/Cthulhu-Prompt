import type { UpdatedPromptFolderData, UpdatedWorkspaceData } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { applyFetchUpdatedPromptFolder } from '../UpdatedPromptFolderDataStore.svelte.ts'
import { applyFetchUpdatedWorkspace } from '../UpdatedWorkspaceDataStore.svelte.ts'
import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'

type UpdatedWorkspaceLoadResult = {
  data: UpdatedWorkspaceData
  revision: number
}

type UpdatedWorkspaceLoadByPathResult = {
  workspace: UpdatedWorkspaceData
  workspaceRevision: number
  promptFolders: Array<{ data: UpdatedPromptFolderData; revision: number }>
}

export const refetchUpdatedWorkspaceById = (workspaceId: string): Promise<void> =>
  runUpdatedRefetch('workspace', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedWorkspaceLoadResult>('updated-load-workspace-by-id', { workspaceId })
    )
    applyFetchUpdatedWorkspace(workspaceId, result.data, result.revision)
  })

export const loadUpdatedWorkspaceByPath = (workspacePath: string): Promise<void> =>
  runUpdatedRefetch('workspace by path', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedWorkspaceLoadByPathResult>('updated-load-workspace-by-path', {
        workspacePath
      })
    )

    applyFetchUpdatedWorkspace(
      result.workspace.workspaceId,
      result.workspace,
      result.workspaceRevision
    )

    for (const promptFolder of result.promptFolders) {
      applyFetchUpdatedPromptFolder(
        promptFolder.data.promptFolderId,
        promptFolder.data,
        promptFolder.revision
      )
    }
  })

// TODO: add updated workspace mutation IPC methods.
