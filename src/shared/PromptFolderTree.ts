import type { PromptFolder } from './PromptFolder'
import type { WorkspaceRoot } from './Workspace'

export const MAX_PROMPT_SUBFOLDER_DEPTH = 8

export type PromptFolderTreeLocation = {
  parentPromptFolderId: string | null
  depth: number
}

export const buildPromptFolderTreeIndex = (
  workspaceRoot: WorkspaceRoot,
  promptFolders: readonly PromptFolder[]
): Map<string, PromptFolderTreeLocation> => {
  const promptFolderById = new Map(promptFolders.map((folder) => [folder.id, folder]))
  const locations = new Map<string, PromptFolderTreeLocation>()

  const visit = (promptFolderId: string, parentPromptFolderId: string | null, depth: number) => {
    if (locations.has(promptFolderId)) return

    const promptFolder = promptFolderById.get(promptFolderId)
    if (!promptFolder) return

    locations.set(promptFolderId, { parentPromptFolderId, depth })
    for (const entry of promptFolder.entries) {
      if (entry.kind === 'folder') visit(entry.id, promptFolderId, depth + 1)
    }
  }

  for (const entry of workspaceRoot.entries) visit(entry.id, null, 0)

  return locations
}
