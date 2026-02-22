import { ipcMain } from 'electron'
import {
  UPDATE_WORKSPACE_PERSISTENCE_CHANNEL,
  UPDATE_USER_PERSISTENCE_CHANNEL,
  USER_PERSISTENCE_ID,
  type UserPersistenceRevisionResponsePayload,
  type WorkspacePersistenceRevisionResponsePayload
} from '@shared/UserPersistence'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import {
  parseUpdateUserPersistenceRevisionRequest,
  parseUpdateWorkspacePersistenceRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'

const buildRevisionPayload = (
  data: UserPersistenceRevisionResponsePayload['userPersistence']['data'],
  revision: number
): UserPersistenceRevisionResponsePayload['userPersistence'] => ({
  id: USER_PERSISTENCE_ID,
  revision,
  data
})

const buildWorkspaceRevisionPayload = (
  workspaceId: string,
  data: WorkspacePersistenceRevisionResponsePayload['workspacePersistence']['data'],
  revision: number
): WorkspacePersistenceRevisionResponsePayload['workspacePersistence'] => ({
  id: workspaceId,
  revision,
  data
})

export const setupUserPersistenceMutationHandlers = (): void => {
  ipcMain.handle(UPDATE_USER_PERSISTENCE_CHANNEL, async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUpdateUserPersistenceRevisionRequest,
      async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const currentRevision = revisions.userPersistence.get(USER_PERSISTENCE_ID)
          const userPersistenceEntity = payload.userPersistence

          if (userPersistenceEntity.expectedRevision !== currentRevision) {
            const userPersistence = UserPersistenceDataAccess.readUserPersistence()
            return {
              success: false,
              conflict: true,
              payload: {
                userPersistence: buildRevisionPayload(userPersistence, currentRevision)
              }
            }
          }

          const userPersistence = UserPersistenceDataAccess.updateUserPersistence(
            userPersistenceEntity.data
          )
          const revision = revisions.userPersistence.bump(USER_PERSISTENCE_ID)

          return {
            success: true,
            payload: {
              userPersistence: buildRevisionPayload(userPersistence, revision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            success: false,
            error: message || 'Failed to update user persistence'
          }
        }
      }
    )
  })

  ipcMain.handle(UPDATE_WORKSPACE_PERSISTENCE_CHANNEL, async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUpdateWorkspacePersistenceRevisionRequest,
      async (validatedRequest) => {
        try {
          const workspacePersistenceEntity = validatedRequest.payload.workspacePersistence
          const workspaceId = workspacePersistenceEntity.id
          const currentRevision = revisions.workspacePersistence.get(workspaceId)

          if (workspacePersistenceEntity.expectedRevision !== currentRevision) {
            const workspacePersistence =
              UserPersistenceDataAccess.readWorkspacePersistence(workspaceId)
            return {
              success: false,
              conflict: true,
              payload: {
                workspacePersistence: buildWorkspaceRevisionPayload(
                  workspaceId,
                  workspacePersistence,
                  currentRevision
                )
              }
            }
          }

          const workspacePersistence = UserPersistenceDataAccess.updateWorkspacePersistence({
            ...workspacePersistenceEntity.data,
            workspaceId
          })
          const revision = revisions.workspacePersistence.bump(workspaceId)

          return {
            success: true,
            payload: {
              workspacePersistence: buildWorkspaceRevisionPayload(
                workspaceId,
                workspacePersistence,
                revision
              )
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            success: false,
            error: message || 'Failed to update workspace persistence'
          }
        }
      }
    )
  })
}
