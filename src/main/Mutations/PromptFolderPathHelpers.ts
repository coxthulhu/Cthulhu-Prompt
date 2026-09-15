import type { PromptFolder } from '@shared/domain/prompt-folder/PromptFolder'
import type { Workspace } from '@shared/domain/workspace/Workspace'
import { getAllWorkspaceFolderEntries } from '@shared/domain/workspace/Workspace'
import { data } from '../Data/Data'

/** Returns loaded root prompt folders in workspace order. */
export const collectWorkspacePromptFolders = (workspace: Workspace): PromptFolder[] =>
  getAllWorkspaceFolderEntries(workspace).flatMap((entry) => {
    /** Loaded root folder referenced by the workspace. */
    const promptFolder = data.promptFolder.committedStore.getEntry(entry.id)?.committed
    return promptFolder ? [promptFolder] : []
  })
