import type { WorkspaceData } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'

type UpdatedWorkspaceLoadResult = {
  data: WorkspaceData
  revision: number
}

export const refetchUpdatedWorkspaceById = (
  workspaceId: string,
  applyFetch: (id: string, data: WorkspaceData, revision: number) => void
): Promise<void> =>
  runUpdatedRefetch('workspace', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedWorkspaceLoadResult>('load-workspace-by-id', { workspaceId })
    )
    applyFetch(workspaceId, result.data, result.revision)
  })

// TODO: add updated workspace mutation IPC methods.
