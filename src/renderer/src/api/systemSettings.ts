import type {
  LoadSystemSettingsResult,
  SystemSettings,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResult
} from '@shared/ipc'

import { makeIpcMutation } from './makeIpcMutation'
import { makeIpcQueryVoid } from './makeIpcQuery'
import { queryKeys } from './queryKeys'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'

const systemSettingsQuery = makeIpcQueryVoid<LoadSystemSettingsResult, SystemSettings | null>({
  key: queryKeys.systemSettings.detail(),
  channel: 'load-system-settings',
  select: (result) => result.settings ?? null,
  initialData: getRuntimeConfig().systemSettings
})

export function useSystemSettingsQuery() {
  return systemSettingsQuery()
}

export function useUpdateSystemSettingsMutation() {
  return makeIpcMutation<UpdateSystemSettingsRequest, UpdateSystemSettingsResult>({
    channel: 'update-system-settings',
    invalidate: () => [queryKeys.systemSettings.detail()]
  })
}
