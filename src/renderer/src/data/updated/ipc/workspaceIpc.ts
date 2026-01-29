import type { UpdatedPromptFolderData, UpdatedWorkspaceData } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

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

export const refetchUpdatedWorkspaceById = (
  workspaceId: string,
  applyFetch: (id: string, data: UpdatedWorkspaceData, revision: number) => void
): Promise<void> =>
  runUpdatedRefetch('workspace', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedWorkspaceLoadResult>('updated-load-workspace-by-id', { workspaceId })
    )
    applyFetch(workspaceId, result.data, result.revision)
  })

export const loadUpdatedWorkspaceByPath = (
  workspacePath: string,
  applyWorkspaceFetch: (id: string, data: UpdatedWorkspaceData, revision: number) => void,
  applyPromptFolderFetch: (id: string, data: UpdatedPromptFolderData, revision: number) => void
): Promise<void> =>
  runUpdatedRefetch('workspace by path', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedWorkspaceLoadByPathResult>('updated-load-workspace-by-path', {
        workspacePath
      })
    )

    applyWorkspaceFetch(result.workspace.workspaceId, result.workspace, result.workspaceRevision)

    for (const promptFolder of result.promptFolders) {
      applyPromptFolderFetch(
        promptFolder.data.promptFolderId,
        promptFolder.data,
        promptFolder.revision
      )
    }
  })

// TODO: add updated workspace mutation IPC methods.
