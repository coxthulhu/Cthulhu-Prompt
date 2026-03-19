import type { SystemSettings } from '@shared/SystemSettings'
import type { PersistenceLayer } from './PersistenceTypes'

export type SystemSettingsPersistenceFields = Record<string, never>

export const systemSettingsPersistence: PersistenceLayer<
  SystemSettings,
  SystemSettingsPersistenceFields
> = {
  persistData: async (_persistenceFields, _data) => {
    // TODO: Persist system settings data.
  },
  loadData: async (_persistenceFields) => {
    // TODO: Load system settings data.
    return null
  },
  removeData: async (_persistenceFields) => {
    // TODO: Remove system settings data.
  }
}
