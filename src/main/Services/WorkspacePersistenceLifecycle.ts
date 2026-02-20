import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import { readWorkspaceId } from '../DataAccess/WorkspaceReads'

export const markWorkspaceOpened = (workspacePath: string): string => {
  const workspaceId = readWorkspaceId(workspacePath)
  UserPersistenceDataAccess.ensureWorkspacePersistenceFile(workspaceId)
  UserPersistenceDataAccess.updateLastWorkspacePath(workspacePath)
  return workspaceId
}

export const markWorkspaceClosed = (): void => {
  UserPersistenceDataAccess.clearLastWorkspacePath()
}
