import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import { readWorkspaceId } from '../DataAccess/WorkspaceReads'

export const markWorkspaceOpened = (workspacePath: string): string => {
  const workspaceId = readWorkspaceId(workspacePath)
  UserPersistenceDataAccess.ensureWorkspacePersistenceFile(workspaceId)
  return workspaceId
}
