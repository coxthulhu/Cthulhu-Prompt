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

const filterLoadedEntityIds = <TData, TPersistenceFields>(
  entityIds: string[],
  getEntry: (entityId: string) => CommittedEntry<TData, TPersistenceFields> | null
): string[] => {
  return entityIds.filter((entityId) => getEntry(entityId) !== null)
}

const getLoadedEntries = <TData, TPersistenceFields>(
  entityIds: string[],
  getEntry: (entityId: string) => CommittedEntry<TData, TPersistenceFields> | null
): CommittedEntry<TData, TPersistenceFields>[] => {
  return entityIds
    .map((entityId) => getEntry(entityId))
    .filter((entry): entry is CommittedEntry<TData, TPersistenceFields> => {
      return entry !== null
    })
}

export const filterLoadedPromptIds = (promptIds: string[]): string[] => {
  return filterLoadedEntityIds(promptIds, (promptId) => data.prompt.committedStore.getEntry(promptId))
}

export const getLoadedPromptEntries = (promptIds: string[]): PromptCommittedEntry[] => {
  return getLoadedEntries(promptIds, (promptId) => data.prompt.committedStore.getEntry(promptId))
}

export const filterLoadedPromptFolderIds = (promptFolderIds: string[]): string[] => {
  return filterLoadedEntityIds(promptFolderIds, (promptFolderId) => {
    return data.promptFolder.committedStore.getEntry(promptFolderId)
  })
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
