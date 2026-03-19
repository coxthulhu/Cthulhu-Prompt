import type { SystemSettings } from '@shared/SystemSettings'
import type { PersistenceLayer } from './PersistenceTypes'

export type SystemSettingsPersistenceFields = Record<string, never>

export const systemSettingsPersistence: PersistenceLayer<
  SystemSettings,
  SystemSettingsPersistenceFields
> = {
  stageChanges: async (_change) => {
    // TODO: Stage system settings persistence changes.
    return {}
  },
  commitChanges: async (_stagedChange) => {
    // TODO: Commit staged system settings persistence changes.
  },
  revertChanges: async (_stagedChange) => {
    // TODO: Revert staged system settings persistence changes.
  },
  loadData: async (_persistenceFields) => {
    // TODO: Load system settings data.
    return null
  }
}
