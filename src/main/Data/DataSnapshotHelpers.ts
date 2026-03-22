import type { PromptPersisted } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { RevisionEnvelope } from '@shared/Revision'
import type { Workspace } from '@shared/Workspace'
import type { PromptFolderPersistenceFields } from '../Persistence/PromptFolderPersistence'
import type { PromptPersistenceFields } from '../Persistence/PromptPersistence'
import type { WorkspacePersistenceFields } from '../Persistence/WorkspacePersistence'
import type { CommittedEntry } from './CommittedStore'
import { data } from './Data'

export type WorkspaceCommittedEntry = CommittedEntry<Workspace, WorkspacePersistenceFields>
export type PromptFolderCommittedEntry = CommittedEntry<PromptFolder, PromptFolderPersistenceFields>
export type PromptCommittedEntry = CommittedEntry<PromptPersisted, PromptPersistenceFields>

export const filterLoadedPromptIds = (promptIds: string[]): string[] => {
  return promptIds.filter((promptId) => data.prompt.committedStore.getEntry(promptId) !== null)
}

export const filterLoadedPromptFolderIds = (promptFolderIds: string[]): string[] => {
  return promptFolderIds.filter(
    (promptFolderId) => data.promptFolder.committedStore.getEntry(promptFolderId) !== null
  )
}

export const buildWorkspaceSnapshot = (
  workspaceEntry: WorkspaceCommittedEntry
): RevisionEnvelope<Workspace> => {
  return {
    id: workspaceEntry.committed.id,
    revision: workspaceEntry.revision,
    data: {
      ...workspaceEntry.committed,
      promptFolderIds: filterLoadedPromptFolderIds(workspaceEntry.committed.promptFolderIds)
    }
  }
}

export const buildPromptFolderSnapshot = (
  promptFolderEntry: PromptFolderCommittedEntry
): RevisionEnvelope<PromptFolder> => {
  return {
    id: promptFolderEntry.committed.id,
    revision: promptFolderEntry.revision,
    data: {
      ...promptFolderEntry.committed,
      promptIds: filterLoadedPromptIds(promptFolderEntry.committed.promptIds)
    }
  }
}

export const buildPromptSnapshot = (
  promptEntry: PromptCommittedEntry
): RevisionEnvelope<PromptPersisted> => {
  return {
    id: promptEntry.committed.id,
    revision: promptEntry.revision,
    data: promptEntry.committed
  }
}
