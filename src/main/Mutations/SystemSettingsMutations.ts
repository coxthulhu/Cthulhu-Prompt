import { ipcMain } from 'electron'
import {
  SYSTEM_SETTINGS_ID,
  normalizeSystemSettings,
  type SystemSettingsRevisionResponsePayload
} from '@shared/SystemSettings'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
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

          const normalizedSettings = normalizeSystemSettings({
            promptFontSize: systemSettingsEntity.data.promptFontSize,
            promptEditorMinLines: systemSettingsEntity.data.promptEditorMinLines
          })

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              systemSettings: tx.systemSettings.update({
                id: SYSTEM_SETTINGS_ID,
                expectedRevision: systemSettingsEntity.expectedRevision,
                recipe: (draft) => {
                  draft.promptFontSize = normalizedSettings.promptFontSize
                  draft.promptEditorMinLines = normalizedSettings.promptEditorMinLines
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            const conflict = transactionOutcome.conflicts.systemSettings
            return {
              success: false,
              conflict: true,
              payload: {
                systemSettings: buildRevisionPayload(conflict.data, conflict.actualRevision)
              }
            }
          }

          const nextSettings = transactionOutcome.results.systemSettings

          return {
            success: true,
            payload: {
              systemSettings: buildRevisionPayload(nextSettings.data, nextSettings.revision)
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
