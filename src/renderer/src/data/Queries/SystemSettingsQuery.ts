import type { RevisionEnvelope } from '@shared/Revision'
import type { SystemSettings } from '@shared/SystemSettings'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'

export const applySystemSettingsSnapshot = (
  snapshot: RevisionEnvelope<SystemSettings>
): void => {
  systemSettingsCollection.utils.upsertAuthoritative({
    id: snapshot.id,
    revision: snapshot.revision,
    data: snapshot.data
  })
}
