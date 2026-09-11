import type { PromptFolder } from '@shared/PromptFolder'
import type { Workspace } from '@shared/Workspace'
import { getAllWorkspaceFolderEntries } from '@shared/Workspace'
import { data } from '../Data/Data'

/** Returns loaded root prompt folders in workspace order. */
export const collectWorkspacePromptFolders = (workspace: Workspace): PromptFolder[] =>
  getAllWorkspaceFolderEntries(workspace).flatMap((entry) => {
    /** Loaded root folder referenced by the workspace. */
    const promptFolder = data.promptFolder.committedStore.getEntry(entry.id)?.committed
    return promptFolder ? [promptFolder] : []
  })
