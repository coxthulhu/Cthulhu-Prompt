import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type {
  TanstackLoadSystemSettingsSuccess,
  TanstackSystemSettings,
  TanstackSystemSettingsRecord,
  TanstackUpdateSystemSettingsRequest,
  TanstackUpdateSystemSettingsSuccess
} from '@shared/tanstack/TanstackSystemSettings'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

const SYSTEM_SETTINGS_RECORD_ID = 'system-settings'

export const tanstackSystemSettingsCollection = createCollection(
  localOnlyCollectionOptions<TanstackSystemSettingsRecord>({
    id: 'tanstack-system-settings',
    getKey: (item) => item.id
  })
)

const toSystemSettingsRecord = (
  settings: TanstackSystemSettings
): TanstackSystemSettingsRecord => ({
  id: SYSTEM_SETTINGS_RECORD_ID,
  ...settings
})

export const setTanstackSystemSettings = (settings: TanstackSystemSettings): void => {
  if (tanstackSystemSettingsCollection.has(SYSTEM_SETTINGS_RECORD_ID)) {
    tanstackSystemSettingsCollection.update(SYSTEM_SETTINGS_RECORD_ID, (draft) => {
      draft.promptFontSize = settings.promptFontSize
      draft.promptEditorMinLines = settings.promptEditorMinLines
    })
    return
  }

  tanstackSystemSettingsCollection.insert(toSystemSettingsRecord(settings))
}

export const getTanstackSystemSettingsRecord = (): TanstackSystemSettingsRecord | null => {
  return tanstackSystemSettingsCollection.get(SYSTEM_SETTINGS_RECORD_ID) ?? null
}

export const refetchTanstackSystemSettings = async (): Promise<void> => {
  const result = await ipcInvoke<TanstackLoadSystemSettingsSuccess>('tanstack-load-system-settings')
  setTanstackSystemSettings(result.settings)
}

export const updateTanstackSystemSettings = async (
  settings: TanstackSystemSettings
): Promise<TanstackSystemSettings> => {
  setTanstackSystemSettings(settings)
  const result = await ipcInvoke<
    TanstackUpdateSystemSettingsSuccess,
    TanstackUpdateSystemSettingsRequest
  >('tanstack-update-system-settings', { settings })
  setTanstackSystemSettings(result.settings)
  return result.settings
}
