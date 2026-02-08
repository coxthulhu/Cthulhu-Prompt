const workspacePathById = new Map<string, string>()
const workspaceIdByPath = new Map<string, string>()
const promptFolderLocationById = new Map<
  string,
  {
    workspaceId: string
    workspacePath: string
    folderName: string
  }
>()
const promptFolderIdsByWorkspaceId = new Map<string, Set<string>>()
let selectedTanstackWorkspaceId: string | null = null

export const registerTanstackWorkspace = (workspaceId: string, workspacePath: string): void => {
  workspacePathById.set(workspaceId, workspacePath)
  workspaceIdByPath.set(workspacePath, workspaceId)
}

export const registerTanstackPromptFolders = (
  workspaceId: string,
  workspacePath: string,
  promptFolders: Array<{ id: string; folderName: string }>
): void => {
  const existingPromptFolderIds = promptFolderIdsByWorkspaceId.get(workspaceId)

  if (existingPromptFolderIds) {
    for (const promptFolderId of existingPromptFolderIds) {
      promptFolderLocationById.delete(promptFolderId)
    }
  }

  const nextPromptFolderIds = new Set<string>()

  for (const promptFolder of promptFolders) {
    promptFolderLocationById.set(promptFolder.id, {
      workspaceId,
      workspacePath,
      folderName: promptFolder.folderName
    })
    nextPromptFolderIds.add(promptFolder.id)
  }

  promptFolderIdsByWorkspaceId.set(workspaceId, nextPromptFolderIds)
}

export const getTanstackWorkspacePath = (workspaceId: string): string | null => {
  return workspacePathById.get(workspaceId) ?? null
}

export const getTanstackWorkspaceId = (workspacePath: string): string | null => {
  return workspaceIdByPath.get(workspacePath) ?? null
}

export const getTanstackPromptFolderLocation = (
  promptFolderId: string
): { workspaceId: string; workspacePath: string; folderName: string } | null => {
  return promptFolderLocationById.get(promptFolderId) ?? null
}

export const setSelectedTanstackWorkspaceId = (workspaceId: string | null): void => {
  selectedTanstackWorkspaceId = workspaceId
}

export const getSelectedTanstackWorkspaceId = (): string | null => {
  return selectedTanstackWorkspaceId
}
