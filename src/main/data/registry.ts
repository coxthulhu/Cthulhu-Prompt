type PromptLocation = {
  workspacePath: string
  folderName: string
}

const workspacePathById = new Map<string, string>()
const promptFolderById = new Map<string, PromptLocation>()
const promptById = new Map<string, PromptLocation>()

// In-memory lookup for updated refetch IPC handlers.
export const resetRegistry = (): void => {
  workspacePathById.clear()
  promptFolderById.clear()
  promptById.clear()
}

export const registerWorkspace = (workspaceId: string, workspacePath: string): void => {
  workspacePathById.set(workspaceId, workspacePath)
}

export const registerPromptFolder = (
  promptFolderId: string,
  workspacePath: string,
  folderName: string
): void => {
  promptFolderById.set(promptFolderId, { workspacePath, folderName })
}

export const registerPrompt = (
  promptId: string,
  workspacePath: string,
  folderName: string
): void => {
  promptById.set(promptId, { workspacePath, folderName })
}

export const getWorkspacePath = (workspaceId: string): string | null =>
  workspacePathById.get(workspaceId) ?? null

export const getPromptFolderLocation = (promptFolderId: string): PromptLocation | null =>
  promptFolderById.get(promptFolderId) ?? null

export const getPromptLocation = (promptId: string): PromptLocation | null =>
  promptById.get(promptId) ?? null
