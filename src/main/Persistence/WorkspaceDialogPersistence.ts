import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { UserPersistenceDataAccess } from './sqlite/UserPersistenceDataAccess'

const isExistingDirectory = (directory: unknown): directory is string => {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) return false
  try {
    return getFs().statSync(directory).isDirectory()
  } catch {
    return false
  }
}

export const readWorkspaceDialogDirectory = (): string => {
  const saved = UserPersistenceDataAccess.readWorkspaceDialogDirectory()
  if (isExistingDirectory(saved)) return saved

  const workspaceInfoPath = UserPersistenceDataAccess.readUserPersistence().lastWorkspaceInfoPath
  const workspaceDirectory = workspaceInfoPath ? path.dirname(workspaceInfoPath) : null
  return isExistingDirectory(workspaceDirectory) ? workspaceDirectory : app.getPath('downloads')
}

export const rememberWorkspaceDialogDirectory = (workspaceInfoPath: string): void => {
  try {
    UserPersistenceDataAccess.updateWorkspaceDialogDirectory(path.dirname(workspaceInfoPath))
  } catch (error) {
    // Remembering the location is best effort; the selected workspace must still open.
    console.warn('Failed to remember the workspace dialog directory', error)
  }
}
