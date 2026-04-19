// Derive the workspace name from the selected folder path.
export const getWorkspaceFolderName = (workspacePath: string): string => {
  const segments = workspacePath.split(/[\\/]+/).filter(Boolean)
  return segments.length ? segments[segments.length - 1] : workspacePath
}
