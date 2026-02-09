import type {
  TanstackSystemSettings,
  TanstackSystemSettingsSnapshot
} from '@shared/tanstack/TanstackSystemSettings'
import { TANSTACK_SYSTEM_SETTINGS_ID } from '@shared/tanstack/TanstackSystemSettings'
import { tanstackSystemSettingsCollection } from '../Collections/TanstackSystemSettingsCollection'

export { tanstackSystemSettingsCollection } from '../Collections/TanstackSystemSettingsCollection'

export const applyTanstackSystemSettingsSnapshot = (
  snapshot: TanstackSystemSettingsSnapshot
): void => {
  tanstackSystemSettingsCollection.utils.upsertAuthoritative({
    id: TANSTACK_SYSTEM_SETTINGS_ID,
    revision: snapshot.revision,
    data: snapshot.settings
  })
}

export const getTanstackSystemSettings = (): TanstackSystemSettings | null => {
  return tanstackSystemSettingsCollection.get(TANSTACK_SYSTEM_SETTINGS_ID) ?? null
}
