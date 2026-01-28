import type { SystemSettings } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'

type UpdatedSystemSettingsLoadResult = {
  data: SystemSettings
  revision: number
}

export const refetchUpdatedSystemSettings = (): Promise<UpdatedSystemSettingsLoadResult> =>
  enqueueUpdatedLoad(() => ipcInvoke<UpdatedSystemSettingsLoadResult>('load-system-settings'))

// TODO: add updated system settings mutation IPC methods.
