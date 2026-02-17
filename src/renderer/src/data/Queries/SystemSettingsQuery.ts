import type { RevisionEnvelope } from '@shared/Revision'
import type { LoadSystemSettingsResult, SystemSettings } from '@shared/SystemSettings'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { upsertSystemSettingsDraft } from '../UiState/SystemSettingsDraftMutations.svelte.ts'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvoke } from '../IpcFramework/IpcRequestInvoke'

export const loadSystemSettings = async (): Promise<void> => {
  const result = await runLoad(() =>
    ipcInvoke<LoadSystemSettingsResult>('load-system-settings')
  )

  const systemSettingsSnapshot: RevisionEnvelope<SystemSettings> = result.systemSettings
  systemSettingsCollection.utils.upsertAuthoritative({
    id: systemSettingsSnapshot.id,
    revision: systemSettingsSnapshot.revision,
    data: systemSettingsSnapshot.data
  })
  upsertSystemSettingsDraft(systemSettingsSnapshot.data)
}
