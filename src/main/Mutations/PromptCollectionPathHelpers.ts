import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import type { Workspace } from '@shared/domain/workspace/Workspace'
import { getAllWorkspaceCollectionEntries } from '@shared/domain/workspace/Workspace'
import { data } from '../Data/Data'

/** Returns loaded prompt collections in workspace order. */
export const collectWorkspacePromptCollections = (workspace: Workspace): PromptCollection[] =>
  getAllWorkspaceCollectionEntries(workspace).flatMap((entry) => {
    /** Loaded collection referenced by the workspace. */
    const promptCollection = data.promptCollection.committedStore.getEntry(entry.id)?.committed
    return promptCollection ? [promptCollection] : []
  })
