import type {
  UpdatedPromptFolderData as PromptFolderData,
  UpdatedWorkspaceData as WorkspaceData
} from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { mergeAuthoritativePromptFolderSnapshot } from '../UpdatedPromptFolderDataStore.svelte.ts'
import { mergeAuthoritativeWorkspaceSnapshot } from '../UpdatedWorkspaceDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type WorkspaceLoadResult = {
  data: WorkspaceData
  revision: number
}

type WorkspaceLoadByPathResult = {
  workspace: WorkspaceData
  workspaceRevision: number
  promptFolders: Array<{ data: PromptFolderData; revision: number }>
}

export const refetchWorkspaceById = (workspaceId: string): Promise<void> =>
  runRefetch('workspace', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<WorkspaceLoadResult>('updated-load-workspace-by-id', { workspaceId })
    )
    mergeAuthoritativeWorkspaceSnapshot(workspaceId, result.data, result.revision)
  })

export const loadWorkspaceByPath = (workspacePath: string): Promise<void> =>
  runRefetch('workspace by path', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<WorkspaceLoadByPathResult>('updated-load-workspace-by-path', {
        workspacePath
      })
    )

    mergeAuthoritativeWorkspaceSnapshot(
      result.workspace.workspaceId,
      result.workspace,
      result.workspaceRevision
    )

    for (const promptFolder of result.promptFolders) {
      mergeAuthoritativePromptFolderSnapshot(
        promptFolder.data.promptFolderId,
        promptFolder.data,
        promptFolder.revision
      )
    }
  })

// TODO: add updated workspace mutation IPC methods.
