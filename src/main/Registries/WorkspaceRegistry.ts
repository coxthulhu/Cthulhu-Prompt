const workspacePathById = new Map<string, string>()
const promptFolderLocationById = new Map<
  string,
  {
    workspaceId: string
    workspacePath: string
    folderName: string
  }
>()
const promptFolderIdsByWorkspaceId = new Map<string, Set<string>>()
const promptLocationById = new Map<
  string,
  {
    workspaceId: string
    workspacePath: string
    folderName: string
    promptFolderId: string
  }
>()
const promptIdsByWorkspaceId = new Map<string, Set<string>>()
const promptIdsByPromptFolderId = new Map<string, Set<string>>()

const clearPromptMappingsForPromptFolder = (promptFolderId: string): void => {
  const promptIds = promptIdsByPromptFolderId.get(promptFolderId)

  if (!promptIds) {
    return
  }

  for (const promptId of promptIds) {
    const location = promptLocationById.get(promptId)

    if (location) {
      const workspacePromptIds = promptIdsByWorkspaceId.get(location.workspaceId)
      workspacePromptIds?.delete(promptId)

      if (workspacePromptIds && workspacePromptIds.size === 0) {
        promptIdsByWorkspaceId.delete(location.workspaceId)
      }
    }

    promptLocationById.delete(promptId)
  }

  promptIdsByPromptFolderId.delete(promptFolderId)
}

export const registerWorkspace = (workspaceId: string, workspacePath: string): void => {
  workspacePathById.set(workspaceId, workspacePath)
}

export const registerPromptFolder = (
  workspaceId: string,
  workspacePath: string,
  promptFolder: { id: string; folderName: string }
): void => {
  const existingLocation = promptFolderLocationById.get(promptFolder.id)

  if (existingLocation && existingLocation.workspaceId !== workspaceId) {
    const previousWorkspacePromptFolderIds = promptFolderIdsByWorkspaceId.get(
      existingLocation.workspaceId
    )
    previousWorkspacePromptFolderIds?.delete(promptFolder.id)

    if (previousWorkspacePromptFolderIds && previousWorkspacePromptFolderIds.size === 0) {
      promptFolderIdsByWorkspaceId.delete(existingLocation.workspaceId)
    }

    clearPromptMappingsForPromptFolder(promptFolder.id)
  }

  promptFolderLocationById.set(promptFolder.id, {
    workspaceId,
    workspacePath,
    folderName: promptFolder.folderName
  })

  let workspacePromptFolderIds = promptFolderIdsByWorkspaceId.get(workspaceId)

  if (!workspacePromptFolderIds) {
    workspacePromptFolderIds = new Set<string>()
    promptFolderIdsByWorkspaceId.set(workspaceId, workspacePromptFolderIds)
  }

  workspacePromptFolderIds.add(promptFolder.id)
}

export const registerPromptFolders = (
  workspaceId: string,
  workspacePath: string,
  promptFolders: Array<{ id: string; folderName: string }>
): void => {
  const existingPromptFolderIds = promptFolderIdsByWorkspaceId.get(workspaceId)

  if (existingPromptFolderIds) {
    for (const promptFolderId of existingPromptFolderIds) {
      promptFolderLocationById.delete(promptFolderId)
      clearPromptMappingsForPromptFolder(promptFolderId)
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

export const getPromptFolderIds = (workspaceId: string): string[] => {
  return Array.from(promptFolderIdsByWorkspaceId.get(workspaceId) ?? [])
}

export const registerPrompts = (
  workspaceId: string,
  workspacePath: string,
  promptFolderId: string,
  folderName: string,
  promptIds: string[]
): void => {
  clearPromptMappingsForPromptFolder(promptFolderId)

  const nextPromptIds = new Set<string>()
  let workspacePromptIds = promptIdsByWorkspaceId.get(workspaceId)

  if (!workspacePromptIds) {
    workspacePromptIds = new Set<string>()
    promptIdsByWorkspaceId.set(workspaceId, workspacePromptIds)
  }

  for (const promptId of promptIds) {
    promptLocationById.set(promptId, {
      workspaceId,
      workspacePath,
      folderName,
      promptFolderId
    })
    workspacePromptIds.add(promptId)
    nextPromptIds.add(promptId)
  }

  promptIdsByPromptFolderId.set(promptFolderId, nextPromptIds)
}

export const getWorkspacePath = (workspaceId: string): string | null => {
  return workspacePathById.get(workspaceId) ?? null
}

export const getPromptFolderLocation = (
  promptFolderId: string
): { workspaceId: string; workspacePath: string; folderName: string } | null => {
  return promptFolderLocationById.get(promptFolderId) ?? null
}

export const getPromptLocation = (
  promptId: string
): {
  workspaceId: string
  workspacePath: string
  folderName: string
  promptFolderId: string
} | null => {
  return promptLocationById.get(promptId) ?? null
}
