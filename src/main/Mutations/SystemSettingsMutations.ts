import { ipcMain } from 'electron'
import {
  SYSTEM_SETTINGS_ID,
  normalizeSystemSettings,
  type SystemSettingsRevisionResponsePayload
} from '@shared/SystemSettings'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { getRequiredSystemSettingsEntry } from '../Data/SystemSettingsData'
import { parseUpdateSystemSettingsRevisionRequest } from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'

const buildRevisionPayload = (
  data: SystemSettingsRevisionResponsePayload['systemSettings']['data'],
  revision: number
): SystemSettingsRevisionResponsePayload['systemSettings'] => ({
  id: SYSTEM_SETTINGS_ID,
  revision,
  data
})

export const setupSystemSettingsMutationHandlers = (): void => {
  ipcMain.handle('update-system-settings', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUpdateSystemSettingsRevisionRequest,
      async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const systemSettingsEntity = payload.systemSettings
          const currentEntry = getRequiredSystemSettingsEntry()

          if (systemSettingsEntity.expectedRevision !== currentEntry.revision) {
            return {
              success: false,
              conflict: true,
              payload: {
                systemSettings: buildRevisionPayload(currentEntry.committed, currentEntry.revision)
              }
            }
          }

          const normalizedSettings = normalizeSystemSettings({
            promptFontSize: systemSettingsEntity.data.promptFontSize,
            promptEditorMinLines: systemSettingsEntity.data.promptEditorMinLines
          })

          await runAtomicDataTransaction([
            {
              type: 'update',
              store: 'systemSettings',
              id: SYSTEM_SETTINGS_ID,
              recipe: (draft) => {
                const typedDraft = draft as {
                  promptFontSize: number
                  promptEditorMinLines: number
                }
                typedDraft.promptFontSize = normalizedSettings.promptFontSize
                typedDraft.promptEditorMinLines = normalizedSettings.promptEditorMinLines
              }
            }
          ])
          const nextEntry = getRequiredSystemSettingsEntry()

          return {
            success: true,
            payload: {
              systemSettings: buildRevisionPayload(nextEntry.committed, nextEntry.revision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            success: false,
            error: message || 'Failed to update system settings'
          }
        }
      }
    )
  })
}
