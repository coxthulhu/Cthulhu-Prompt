import { ipcMain } from 'electron'
import type {
  TanstackMutationResult,
  TanstackMutationWireRequest,
  TanstackSystemSettingsRevisionData,
  TanstackSystemSettingsRevisionResponsePayload,
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { TANSTACK_SYSTEM_SETTINGS_ID } from '@shared/tanstack/TanstackSystemSettings'
import { TanstackSystemSettingsDataAccess } from '../DataAccess/TanstackSystemSettingsDataAccess'
import { parseTanstackUpdateSystemSettingsRevisionRequest } from '../IpcFramework/TanstackIpcValidation'
import { runTanstackMutationIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { tanstackRevisions } from '../Registries/TanstackRevisions'

const buildRevisionPayload = (
  data: TanstackSystemSettingsRevisionData['data'],
  revision: number
): TanstackSystemSettingsRevisionData => ({
  id: TANSTACK_SYSTEM_SETTINGS_ID,
  revision,
  data
})

export const setupTanstackSystemSettingsMutationHandlers = (): void => {
  ipcMain.handle(
    'tanstack-update-system-settings',
    async (
      _,
      request: unknown
    ): Promise<TanstackUpdateSystemSettingsRevisionResult> => {
      return await runTanstackMutationIpcRequest<
        TanstackMutationWireRequest<TanstackUpdateSystemSettingsRevisionRequest>,
        TanstackMutationResult<TanstackSystemSettingsRevisionResponsePayload>
      >(request, parseTanstackUpdateSystemSettingsRevisionRequest, async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const currentRevision = tanstackRevisions.systemSettings.get(TANSTACK_SYSTEM_SETTINGS_ID)
          const systemSettingsEntity = payload.systemSettings

          if (systemSettingsEntity.expectedRevision !== currentRevision) {
            const settings = await TanstackSystemSettingsDataAccess.loadSystemSettings()
            return {
              success: false,
              conflict: true,
              payload: {
                systemSettings: buildRevisionPayload(settings, currentRevision)
              }
            }
          }

          const settings = await TanstackSystemSettingsDataAccess.updateSystemSettings(
            systemSettingsEntity.data
          )
          const revision = tanstackRevisions.systemSettings.bump(TANSTACK_SYSTEM_SETTINGS_ID)

          return {
            success: true,
            payload: {
              systemSettings: buildRevisionPayload(settings, revision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            success: false,
            error: message || 'Failed to update system settings'
          }
        }
      })
    }
  )
}
