import { ipcMain } from 'electron'
import type {
  LoadUserPersistenceResult,
  LoadWorkspacePersistenceResult
} from '@shared/UserPersistence'
import { parseLoadWorkspacePersistenceRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'

export const setupUserPersistenceQueryHandlers = (): void => {
  ipcMain.handle('load-user-persistence', async (): Promise<LoadUserPersistenceResult> => {
    try {
      const userPersistence = UserPersistenceDataAccess.readUserPersistence()
      return {
        success: true,
        userPersistence
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message || 'Failed to load user persistence' }
    }
  })

  ipcMain.handle(
    'load-workspace-persistence',
    async (_, request: unknown): Promise<LoadWorkspacePersistenceResult> => {
      return await runQueryIpcRequest(
        request,
        parseLoadWorkspacePersistenceRequest,
        async (validatedRequest) => {
          try {
            const workspacePersistence = UserPersistenceDataAccess.readWorkspacePersistence(
              validatedRequest.payload.workspaceId
            )
            return {
              success: true,
              workspacePersistence
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            return { success: false, error: message || 'Failed to load workspace persistence' }
          }
        }
      )
    }
  )
}
