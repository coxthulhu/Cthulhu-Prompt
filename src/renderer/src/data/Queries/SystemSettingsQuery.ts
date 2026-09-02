import { SYSTEM_SETTINGS_ID, type LoadSystemSettingsResult } from '@shared/SystemSettings'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { upsertSystemSettingsClientState } from '../UiState/SystemSettingsClientStateMutations.svelte.ts'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvoke } from '../IpcFramework/IpcRequestInvoke'
import { reconcileRendererAuthoritativeSnapshots } from '../IpcFramework/AuthoritativeSnapshots'

export const loadSystemSettings = async (): Promise<void> => {
  const result = await runLoad(() => ipcInvoke<LoadSystemSettingsResult>('load-system-settings'))

  reconcileRendererAuthoritativeSnapshots(result.snapshots)
  /** Reconciled authoritative settings used to hydrate renderer-only editable form state. */
  const systemSettings = systemSettingsCollection.get(SYSTEM_SETTINGS_ID)!
  upsertSystemSettingsClientState(systemSettings)
}
