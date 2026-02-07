const workspacePathById = new Map<string, string>()
const workspaceIdByPath = new Map<string, string>()

export const registerTanstackWorkspace = (workspaceId: string, workspacePath: string): void => {
  workspacePathById.set(workspaceId, workspacePath)
  workspaceIdByPath.set(workspacePath, workspaceId)
}

export const getTanstackWorkspacePath = (workspaceId: string): string | null => {
  return workspacePathById.get(workspaceId) ?? null
}

export const getTanstackWorkspaceId = (workspacePath: string): string | null => {
  return workspaceIdByPath.get(workspacePath) ?? null
}
