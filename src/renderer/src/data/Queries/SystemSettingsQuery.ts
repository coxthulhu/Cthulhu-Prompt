import type { SystemSettingsSnapshot } from '@shared/SystemSettings'
import { SYSTEM_SETTINGS_ID } from '@shared/SystemSettings'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'

export const applySystemSettingsSnapshot = (
  snapshot: SystemSettingsSnapshot
): void => {
  systemSettingsCollection.utils.upsertAuthoritative({
    id: SYSTEM_SETTINGS_ID,
    revision: snapshot.revision,
    data: snapshot.settings
  })
}
