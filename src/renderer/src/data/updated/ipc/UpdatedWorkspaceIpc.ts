import type {
  ResponseData,
  UpdatedPromptFolderData as PromptFolderData,
  UpdatedWorkspaceData as WorkspaceData
} from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { mergeAuthoritativePromptFolderSnapshot } from '../UpdatedPromptFolderDataStore.svelte.ts'
import { mergeAuthoritativeWorkspaceSnapshot } from '../UpdatedWorkspaceDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type WorkspaceLoadResult = ResponseData<WorkspaceData>

type WorkspaceLoadByPathResult = {
  workspace: ResponseData<WorkspaceData>
  promptFolders: Array<ResponseData<PromptFolderData>>
}

export const refetchWorkspaceById = (workspaceId: string): Promise<void> =>
  runRefetch('workspace', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<WorkspaceLoadResult>('updated-load-workspace-by-id', { id: workspaceId })
    )
    mergeAuthoritativeWorkspaceSnapshot(result.id, result.data, result.revision)
  })

export const loadWorkspaceByPath = (workspacePath: string): Promise<void> =>
  runRefetch('workspace by path', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<WorkspaceLoadByPathResult>('updated-load-workspace-by-path', {
        workspacePath
      })
    )

    mergeAuthoritativeWorkspaceSnapshot(
      result.workspace.id,
      result.workspace.data,
      result.workspace.revision
    )

    for (const promptFolder of result.promptFolders) {
      mergeAuthoritativePromptFolderSnapshot(
        promptFolder.id,
        promptFolder.data,
        promptFolder.revision
      )
    }
  })

// TODO: add updated workspace mutation IPC methods.
