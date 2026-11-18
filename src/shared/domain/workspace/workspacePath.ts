import { preparePromptCollectionName } from '@shared/domain/prompt-collection/promptCollectionName'

const WINDOWS_DRIVE_ROOT_REGEX = /^[a-zA-Z]:[\\/]*$/
const POSIX_ROOT_REGEX = /^\/+$/

export const workspaceRootPathErrorMessage = 'Choose a folder inside a drive, not the drive root.'

// Windows-only workspace validation: block drive roots and "/".
export const isWorkspaceRootPath = (workspacePath: string): boolean => {
  const trimmedPath = workspacePath.trim()
  return POSIX_ROOT_REGEX.test(trimmedPath) || WINDOWS_DRIVE_ROOT_REGEX.test(trimmedPath)
}

/** File suffix for workspace info files and their Windows file association. */
export const WORKSPACE_INFO_FILENAME_SUFFIX = '.cthulhuprompt'

/** Windows path of the workspace info file created for a workspace name. */
export const resolveWorkspaceInfoPath = (workspacePath: string, workspaceName: string): string => {
  /** Workspace names follow the same filename rules as collection directories. */
  const workspaceFileName = preparePromptCollectionName(workspaceName).folderName
  return `${workspacePath.replace(/[\\/]+$/, '')}\\${workspaceFileName}${WORKSPACE_INFO_FILENAME_SUFFIX}`
}
