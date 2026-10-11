const workspacePathById = new Map<string, string>()
const promptCollectionLocationById = new Map<
  string,
  {
    workspaceId: string
    workspacePath: string
    folderName: string
  }
>()
const promptCollectionIdsByWorkspaceId = new Map<string, Set<string>>()
const promptLocationById = new Map<
  string,
  {
    workspaceId: string
    workspacePath: string
    folderName: string
    promptCollectionId: string
  }
>()
const promptIdsByWorkspaceId = new Map<string, Set<string>>()
const promptIdsByPromptCollectionId = new Map<string, Set<string>>()

const clearPromptMappingsForPromptCollection = (promptCollectionId: string): void => {
  const promptIds = promptIdsByPromptCollectionId.get(promptCollectionId)

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

  promptIdsByPromptCollectionId.delete(promptCollectionId)
}

export const registerWorkspace = (workspaceId: string, workspacePath: string): void => {
  workspacePathById.set(workspaceId, workspacePath)
}

export const registerPromptCollection = (
  workspaceId: string,
  workspacePath: string,
  promptCollection: { id: string; folderName: string }
): void => {
  const existingLocation = promptCollectionLocationById.get(promptCollection.id)

  if (existingLocation && existingLocation.workspaceId !== workspaceId) {
    const previousWorkspacePromptCollectionIds = promptCollectionIdsByWorkspaceId.get(
      existingLocation.workspaceId
    )
    previousWorkspacePromptCollectionIds?.delete(promptCollection.id)

    if (previousWorkspacePromptCollectionIds && previousWorkspacePromptCollectionIds.size === 0) {
      promptCollectionIdsByWorkspaceId.delete(existingLocation.workspaceId)
    }

    clearPromptMappingsForPromptCollection(promptCollection.id)
  }

  promptCollectionLocationById.set(promptCollection.id, {
    workspaceId,
    workspacePath,
    folderName: promptCollection.folderName
  })

  let workspacePromptCollectionIds = promptCollectionIdsByWorkspaceId.get(workspaceId)

  if (!workspacePromptCollectionIds) {
    workspacePromptCollectionIds = new Set<string>()
    promptCollectionIdsByWorkspaceId.set(workspaceId, workspacePromptCollectionIds)
  }

  workspacePromptCollectionIds.add(promptCollection.id)
}

export const registerPromptCollections = (
  workspaceId: string,
  workspacePath: string,
  promptCollections: Array<{ id: string; folderName: string }>
): void => {
  const existingPromptCollectionIds = promptCollectionIdsByWorkspaceId.get(workspaceId)

  if (existingPromptCollectionIds) {
    for (const promptCollectionId of existingPromptCollectionIds) {
      promptCollectionLocationById.delete(promptCollectionId)
      clearPromptMappingsForPromptCollection(promptCollectionId)
    }
  }

  const nextPromptCollectionIds = new Set<string>()

  for (const promptCollection of promptCollections) {
    promptCollectionLocationById.set(promptCollection.id, {
      workspaceId,
      workspacePath,
      folderName: promptCollection.folderName
    })
    nextPromptCollectionIds.add(promptCollection.id)
  }

  promptCollectionIdsByWorkspaceId.set(workspaceId, nextPromptCollectionIds)
}

export const getPromptCollectionIds = (workspaceId: string): string[] => {
  return Array.from(promptCollectionIdsByWorkspaceId.get(workspaceId) ?? [])
}

export const registerPrompts = (
  workspaceId: string,
  workspacePath: string,
  promptCollectionId: string,
  folderName: string,
  promptIds: string[]
): void => {
  clearPromptMappingsForPromptCollection(promptCollectionId)

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
      promptCollectionId
    })
    workspacePromptIds.add(promptId)
    nextPromptIds.add(promptId)
  }

  promptIdsByPromptCollectionId.set(promptCollectionId, nextPromptIds)
}

export const getWorkspacePath = (workspaceId: string): string | null => {
  return workspacePathById.get(workspaceId) ?? null
}

export const getPromptCollectionLocation = (
  promptCollectionId: string
): { workspaceId: string; workspacePath: string; folderName: string } | null => {
  return promptCollectionLocationById.get(promptCollectionId) ?? null
}

export const getPromptLocation = (
  promptId: string
): {
  workspaceId: string
  workspacePath: string
  folderName: string
  promptCollectionId: string
} | null => {
  return promptLocationById.get(promptId) ?? null
}
