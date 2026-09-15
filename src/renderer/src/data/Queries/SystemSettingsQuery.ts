import { LOAD_SYSTEM_SETTINGS_CHANNEL, SYSTEM_SETTINGS_ID } from '@shared/domain/settings/SystemSettings'
import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
import { upsertSystemSettingsClientState } from '@renderer/data/UiState/client-state/SystemSettingsClientStateMutations.svelte.ts'
import { runRendererAuthoritativeQuery } from '@renderer/data/IpcFramework/AuthoritativeQuery'

export const loadSystemSettings = async (): Promise<void> => {
  await runRendererAuthoritativeQuery(LOAD_SYSTEM_SETTINGS_CHANNEL)
  /** Reconciled authoritative settings used to hydrate renderer-only editable form state. */
  const systemSettings = systemSettingsCollection.get(SYSTEM_SETTINGS_ID)!
  upsertSystemSettingsClientState(systemSettings)
}
