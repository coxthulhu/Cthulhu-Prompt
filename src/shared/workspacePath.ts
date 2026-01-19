const WINDOWS_DRIVE_ROOT_REGEX = /^[a-zA-Z]:[\\/]*$/
const POSIX_ROOT_REGEX = /^\/+$/

export const workspaceRootPathErrorMessage =
  'Choose a folder inside a drive, not the drive root.'

// Windows-only workspace validation: block drive roots and "/".
export const isWorkspaceRootPath = (workspacePath: string): boolean => {
  const trimmedPath = workspacePath.trim()
  return POSIX_ROOT_REGEX.test(trimmedPath) || WINDOWS_DRIVE_ROOT_REGEX.test(trimmedPath)
}
