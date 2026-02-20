import { ipcMain } from 'electron'
import {
  LOAD_USER_PERSISTENCE_CHANNEL,
  LOAD_WORKSPACE_PERSISTENCE_CHANNEL
} from '@shared/UserPersistence'
import type {
  LoadUserPersistenceResult,
  LoadWorkspacePersistenceResult
} from '@shared/UserPersistence'
import { parseLoadWorkspacePersistenceRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

export const setupUserPersistenceQueryHandlers = (): void => {
  ipcMain.handle(
    LOAD_USER_PERSISTENCE_CHANNEL,
    async (): Promise<LoadUserPersistenceResult> => {
      try {
        const userPersistence = UserPersistenceDataAccess.readUserPersistence()
        return {
          success: true,
          userPersistence
        }
      } catch (error) {
        return { success: false, error: getErrorMessage(error) }
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
              workspacePersistence
            }
          } catch (error) {
            return { success: false, error: getErrorMessage(error) }
          }
        }
      )
    }
  )
}
