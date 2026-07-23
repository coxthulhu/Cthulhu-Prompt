import type { PromptPersisted } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import type { EntryRef, FolderEntryRef } from '@shared/OrderContainer'
import type { RevisionEnvelope } from '@shared/Revision'
import type { Workspace } from '@shared/Workspace'
import type { PromptFolderPersistenceFields } from '../Persistence/PromptFolderPersistence'
import {
  readPromptModifiedAt,
  type PromptPersistenceFields
} from '../Persistence/PromptPersistence'
import {
  readPromptTemplateModifiedAt,
  type PromptTemplatePersistenceFields
} from '../Persistence/PromptTemplatePersistence'
import type { WorkspacePersistenceFields } from '../Persistence/WorkspacePersistence'
import type { CommittedEntry } from './CommittedStore'
import { data } from './Data'

export type WorkspaceCommittedEntry = CommittedEntry<Workspace, WorkspacePersistenceFields>
export type PromptFolderCommittedEntry = CommittedEntry<PromptFolder, PromptFolderPersistenceFields>
export type PromptCommittedEntry = CommittedEntry<PromptPersisted, PromptPersistenceFields>
export type PromptTemplateCommittedEntry = CommittedEntry<
  PromptTemplatePersisted,
  PromptTemplatePersistenceFields
>

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
  return filterLoadedEntityIds(promptIds, (promptId) =>
    data.prompt.committedStore.getEntry(promptId)
  )
}

export const getLoadedPromptEntries = (promptIds: string[]): PromptCommittedEntry[] => {
  return getLoadedEntries(promptIds, (promptId) => data.prompt.committedStore.getEntry(promptId))
}

export const getLoadedPromptTemplateEntries = (
  promptTemplateIds: string[]
): PromptTemplateCommittedEntry[] => {
  return getLoadedEntries(promptTemplateIds, (promptTemplateId) =>
    data.promptTemplate.committedStore.getEntry(promptTemplateId)
  )
}

export const filterLoadedPromptFolderEntries = (entries: FolderEntryRef[]): FolderEntryRef[] => {
  return entries.filter((entry) => data.promptFolder.committedStore.getEntry(entry.id) !== null)
}

export const filterLoadedPromptFolderEntriesByKind = (entries: EntryRef[]): EntryRef[] => {
  return entries.filter((entry) => {
    if (entry.kind === 'prompt') return data.prompt.committedStore.getEntry(entry.id) !== null
    if (entry.kind === 'template') {
      return data.promptTemplate.committedStore.getEntry(entry.id) !== null
    }
    return data.promptFolder.committedStore.getEntry(entry.id) !== null
  })
}

export const collectLoadedPromptFolderDescendantIds = (promptFolderId: string): string[] => {
  const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderId)

  if (!promptFolderEntry) {
    return []
  }

  const descendantIds: string[] = []
  for (const entry of promptFolderEntry.committed.entries) {
    if (entry.kind !== 'folder' || !data.promptFolder.committedStore.getEntry(entry.id)) continue

    descendantIds.push(entry.id)
    descendantIds.push(...collectLoadedPromptFolderDescendantIds(entry.id))
  }

  return descendantIds
}

export const buildWorkspaceSnapshot = (
  workspaceEntry: WorkspaceCommittedEntry
): RevisionEnvelope<Workspace> => {
  return {
    id: workspaceEntry.committed.id,
    revision: workspaceEntry.revision,
    data: {
      ...workspaceEntry.committed,
      entries: filterLoadedPromptFolderEntries(workspaceEntry.committed.entries)
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
      entries: filterLoadedPromptFolderEntriesByKind(promptFolderEntry.committed.entries),
      completedPromptIds: filterLoadedPromptIds(promptFolderEntry.committed.completedPromptIds)
    }
  }
}

export const buildPromptSnapshot = (
  promptEntry: PromptCommittedEntry
): RevisionEnvelope<PromptPersisted> => {
  return {
    id: promptEntry.committed.id,
    revision: promptEntry.revision,
    data: {
      ...promptEntry.committed,
      modifiedAt: readPromptModifiedAt(promptEntry.persistenceFields)
    }
  }
}

export const buildPromptTemplateSnapshot = (
  promptTemplateEntry: PromptTemplateCommittedEntry
): RevisionEnvelope<PromptTemplatePersisted> => ({
  id: promptTemplateEntry.committed.id,
  revision: promptTemplateEntry.revision,
  data: {
    ...promptTemplateEntry.committed,
    modifiedAt: readPromptTemplateModifiedAt(promptTemplateEntry.persistenceFields)
  }
})
