import { LOAD_SYSTEM_SETTINGS_CHANNEL, SYSTEM_SETTINGS_ID } from '@shared/SystemSettings'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { upsertSystemSettingsClientState } from '../UiState/SystemSettingsClientStateMutations.svelte.ts'
import { runRendererAuthoritativeQuery } from '../IpcFramework/AuthoritativeQuery'

export const loadSystemSettings = async (): Promise<void> => {
  await runRendererAuthoritativeQuery(LOAD_SYSTEM_SETTINGS_CHANNEL)
  /** Reconciled authoritative settings used to hydrate renderer-only editable form state. */
  const systemSettings = systemSettingsCollection.get(SYSTEM_SETTINGS_ID)!
  upsertSystemSettingsClientState(systemSettings)
}
