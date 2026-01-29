import type { SystemSettings } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { applyFetchUpdatedSystemSettings } from '../UpdatedSystemSettingsStore.svelte.ts'
import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'

type UpdatedSystemSettingsLoadResult = {
  data: SystemSettings
  revision: number
}

export const refetchUpdatedSystemSettings = (): Promise<void> =>
  runUpdatedRefetch('system settings', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedSystemSettingsLoadResult>('updated-load-system-settings')
    )
    applyFetchUpdatedSystemSettings(result.data, result.revision)
  })

// TODO: add updated system settings mutation IPC methods.
