import * as path from 'path'
import { PromptStatus } from '@shared/Prompt'
import { buildPromptFolderTreeIndex } from '@shared/PromptFolderTree'
import type { PromptFolder } from '@shared/PromptFolder'
import type { Workspace } from '@shared/Workspace'
import { resolveCompletedPromptFolderName } from '../Persistence/PromptPersistencePaths'
import { data } from '../Data/Data'

export type PromptFolderPathOverride = {
  folderName: string
}

export const collectWorkspacePromptFolders = (workspace: Workspace): PromptFolder[] => {
  const promptFolders: PromptFolder[] = []
  const visitedIds = new Set<string>()

  const visit = (promptFolderId: string) => {
    if (visitedIds.has(promptFolderId)) return
    const promptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)?.committed
    if (!promptFolder) return

    visitedIds.add(promptFolderId)
    promptFolders.push(promptFolder)
    for (const entry of promptFolder.entries) {
      if (entry.kind === 'folder') visit(entry.id)
    }
  }

  for (const entry of workspace.entries) visit(entry.id)
  return promptFolders
}

export const resolvePromptFolderPathFromData = (
  promptFolderId: string,
  overrides: Map<string, PromptFolderPathOverride> = new Map()
): string => {
  const override = overrides.get(promptFolderId)
  const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderId)
  const promptFolder = promptFolderEntry?.committed

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const workspace = data.workspace.committedStore.getEntry(
    promptFolderEntry.persistenceFields.workspaceId
  )?.committed
  if (!workspace) throw new Error('Workspace not loaded')

  const treeIndex = buildPromptFolderTreeIndex(workspace, collectWorkspacePromptFolders(workspace))
  const parentPromptFolderId = treeIndex.get(promptFolderId)?.parentPromptFolderId ?? null
  const folderName = override?.folderName ?? promptFolder.folderName
  if (parentPromptFolderId === null) return folderName

  return path.join(resolvePromptFolderPathFromData(parentPromptFolderId, overrides), folderName)
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
    folderPath
  })

  for (const entry of promptFolderEntry.committed.entries) {
    if (entry.kind === 'folder') {
      refreshPromptFolderTreePersistencePaths(entry.id)
      continue
    }

    if (entry.kind === 'template') {
      const templateEntry = data.promptTemplate.committedStore.getEntry(entry.id)
      if (templateEntry) {
        data.promptTemplate.committedStore.updatePersistenceFields(entry.id, {
          ...templateEntry.persistenceFields,
          folderPath
        })
      }
      continue
    }

    const promptEntry = data.prompt.committedStore.getEntry(entry.id)
    if (promptEntry) {
      const targetFolderPath =
        promptEntry.committed.status === PromptStatus.Completed
          ? resolveCompletedPromptFolderName(folderPath)
          : folderPath
      data.prompt.committedStore.updatePersistenceFields(entry.id, {
        ...promptEntry.persistenceFields,
        folderPath: targetFolderPath
      })
    }
  }

  for (const promptId of promptFolderEntry.committed.completedPromptIds) {
    const promptEntry = data.prompt.committedStore.getEntry(promptId)
    if (promptEntry) {
      data.prompt.committedStore.updatePersistenceFields(promptId, {
        ...promptEntry.persistenceFields,
        folderPath: resolveCompletedPromptFolderName(folderPath)
      })
    }
  }
}
