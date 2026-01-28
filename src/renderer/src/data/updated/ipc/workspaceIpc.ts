import type { WorkspaceData } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'

type UpdatedWorkspaceLoadResult = {
  data: WorkspaceData
  revision: number
}

export const refetchUpdatedWorkspaceById = (
  workspaceId: string
): Promise<UpdatedWorkspaceLoadResult> =>
  enqueueUpdatedLoad(() =>
    ipcInvoke<UpdatedWorkspaceLoadResult>('load-workspace-by-id', { workspaceId })
  )

// TODO: add updated workspace mutation IPC methods.
