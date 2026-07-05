import * as path from 'path'
import { resolveCompletedPromptFolderName } from '../Persistence/PromptPersistencePaths'
import { data } from '../Data/Data'

export type PromptFolderPathOverride = {
  folderName: string
  parentPromptFolderId: string | null
}

export const resolvePromptFolderPathFromData = (
  promptFolderId: string,
  overrides: Map<string, PromptFolderPathOverride> = new Map()
): string => {
  const override = overrides.get(promptFolderId)
  const promptFolder = override ?? data.promptFolder.committedStore.getEntry(promptFolderId)?.committed

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  if (promptFolder.parentPromptFolderId === null) {
    return promptFolder.folderName
  }

  return path.join(
    resolvePromptFolderPathFromData(promptFolder.parentPromptFolderId, overrides),
    promptFolder.folderName
  )
}

export const refreshPromptFolderTreePersistencePaths = (promptFolderId: string): void => {
  const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderId)

  if (!promptFolderEntry) {
    return
  }

  const folderPath = resolvePromptFolderPathFromData(promptFolderId)

  data.promptFolder.committedStore.updatePersistenceFields(promptFolderId, {
    ...promptFolderEntry.persistenceFields,
    folderName: promptFolderEntry.committed.folderName,
    folderPath,
    parentPromptFolderId: promptFolderEntry.committed.parentPromptFolderId,
    depth: promptFolderEntry.committed.depth
  })

  for (const promptId of promptFolderEntry.committed.entryIds) {
    const childPromptFolder = data.promptFolder.committedStore.getEntry(promptId)
    if (childPromptFolder) {
      refreshPromptFolderTreePersistencePaths(promptId)
      continue
    }

    const promptEntry = data.prompt.committedStore.getEntry(promptId)
    if (promptEntry) {
      data.prompt.committedStore.updatePersistenceFields(promptId, {
        ...promptEntry.persistenceFields,
        folderPath
      })
    }
  }

  const completedFolderPath = resolveCompletedPromptFolderName(folderPath)
  for (const promptId of promptFolderEntry.committed.completedPromptIds) {
    const promptEntry = data.prompt.committedStore.getEntry(promptId)
    if (!promptEntry) {
      continue
    }

    data.prompt.committedStore.updatePersistenceFields(promptId, {
      ...promptEntry.persistenceFields,
      folderPath: completedFolderPath
    })
  }
}
