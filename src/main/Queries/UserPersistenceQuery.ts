import { ipcMain } from 'electron'
import {
  LOAD_USER_PERSISTENCE_CHANNEL,
  LOAD_WORKSPACE_PERSISTENCE_CHANNEL,
  USER_PERSISTENCE_ID
} from '@shared/UserPersistence'
import type {
  LoadUserPersistenceResult,
  LoadWorkspacePersistenceResult
} from '@shared/UserPersistence'
import { parseLoadWorkspacePersistenceRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import { revisions } from '../Registries/Revisions'

export const setupUserPersistenceQueryHandlers = (): void => {
  ipcMain.handle(
    LOAD_USER_PERSISTENCE_CHANNEL,
    async (): Promise<LoadUserPersistenceResult> => {
      try {
        const userPersistence = UserPersistenceDataAccess.readUserPersistence()
        return {
          success: true,
          userPersistence: {
            id: USER_PERSISTENCE_ID,
            revision: revisions.userPersistence.get(USER_PERSISTENCE_ID),
            data: userPersistence
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    LOAD_WORKSPACE_PERSISTENCE_CHANNEL,
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
              workspacePersistence: {
                id: validatedRequest.payload.workspaceId,
                revision: revisions.workspacePersistence.get(validatedRequest.payload.workspaceId),
                data: workspacePersistence
              }
            }
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) }
          }
        }
      )
    }
  )
}
