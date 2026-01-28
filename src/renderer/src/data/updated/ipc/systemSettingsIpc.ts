import type { SystemSettings } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'

type UpdatedSystemSettingsLoadResult = {
  data: SystemSettings
  revision: number
}

export const refetchUpdatedSystemSettings = (
  applyFetch: (data: SystemSettings, revision: number) => void
): Promise<void> =>
  runUpdatedRefetch('system settings', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedSystemSettingsLoadResult>('load-system-settings')
    )
    applyFetch(result.data, result.revision)
  })

// TODO: add updated system settings mutation IPC methods.
