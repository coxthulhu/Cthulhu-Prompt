import type { RevisionEnvelope } from '@shared/Revision'
import type { SystemSettings } from '@shared/SystemSettings'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { upsertSystemSettingsDraft } from '../UiState/SystemSettingsDraftStore.svelte.ts'

export const applySystemSettingsSnapshot = (
  snapshot: RevisionEnvelope<SystemSettings>
): void => {
  systemSettingsCollection.utils.upsertAuthoritative({
    id: snapshot.id,
    revision: snapshot.revision,
    data: snapshot.data
  })
  upsertSystemSettingsDraft(snapshot.data)
}
