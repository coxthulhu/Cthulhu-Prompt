import type { SystemSettings } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { mergeAuthoritativeSystemSettingsSnapshot } from '../UpdatedSystemSettingsStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type SystemSettingsLoadResult = {
  data: SystemSettings
  revision: number
}

export const refetchSystemSettings = (): Promise<void> =>
  runRefetch('system settings', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<SystemSettingsLoadResult>('updated-load-system-settings')
    )
    mergeAuthoritativeSystemSettingsSnapshot(result.data, result.revision)
  })

// TODO: add updated system settings mutation IPC methods.
