import { LOAD_SYSTEM_SETTINGS_CHANNEL, SYSTEM_SETTINGS_ID } from '@shared/SystemSettings'
import { getRequiredSystemSettingsEntry } from '../Data/SystemSettingsData'
import { handleMainAuthoritativeQuery } from '../IpcFramework/AuthoritativeQuery'

export const setupSystemSettingsQueryHandlers = (): void => {
  handleMainAuthoritativeQuery({
    channel: LOAD_SYSTEM_SETTINGS_CHANNEL,
    /** Verifies the required singleton is loaded before selecting its snapshot target. */
    query: () => {
      getRequiredSystemSettingsEntry()
      return [{ entityType: 'systemSettings', id: SYSTEM_SETTINGS_ID }]
    }
  })
}
