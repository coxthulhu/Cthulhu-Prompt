import type { PromptPersisted } from '@shared/Prompt'
import type { CategoryOrder, PromptFolder } from '@shared/PromptFolder'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import type { FolderEntryRef } from '@shared/OrderContainer'
import type { RevisionEnvelope } from '@shared/Revision'
import type { Workspace } from '@shared/Workspace'
import type { Category } from '@shared/Category'
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
import type { CategoryPersistenceFields } from '../Persistence/CategoryPersistence'
import type { CommittedEntry } from './CommittedStore'
import { data } from './Data'

export type WorkspaceCommittedEntry = CommittedEntry<Workspace, WorkspacePersistenceFields>
export type PromptFolderCommittedEntry = CommittedEntry<PromptFolder, PromptFolderPersistenceFields>
export type PromptCommittedEntry = CommittedEntry<PromptPersisted, PromptPersistenceFields>
export type PromptTemplateCommittedEntry = CommittedEntry<
  PromptTemplatePersisted,
  PromptTemplatePersistenceFields
>
/** Loaded category entry with its persisted filename state. */
export type CategoryCommittedEntry = CommittedEntry<Category, CategoryPersistenceFields>

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

/** Filters category groups and entries to entities loaded in authoritative stores. */
const filterLoadedCategoryOrder = (categoryOrder: CategoryOrder): CategoryOrder => ({
  categories: categoryOrder.categories.flatMap((category) => {
    if (
      category.categoryId !== null &&
      data.category.committedStore.getEntry(category.categoryId) === null
    ) {
      return []
    }
    return [
      {
        ...category,
        entries: category.entries.filter((entry) =>
          entry.kind === 'prompt'
            ? data.prompt.committedStore.getEntry(entry.id) !== null
            : data.promptTemplate.committedStore.getEntry(entry.id) !== null
        )
      }
    ]
  })
})

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

/** Returns loaded category entries for the requested IDs. */
export const getLoadedCategoryEntries = (categoryIds: string[]): CategoryCommittedEntry[] => {
  return getLoadedEntries(categoryIds, (categoryId) =>
    data.category.committedStore.getEntry(categoryId)
  )
}

export const filterLoadedPromptFolderEntries = (entries: FolderEntryRef[]): FolderEntryRef[] => {
  return entries.filter((entry) => data.promptFolder.committedStore.getEntry(entry.id) !== null)
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
      completedPromptIds: filterLoadedPromptIds(promptFolderEntry.committed.completedPromptIds),
      categoryOrder: filterLoadedCategoryOrder(promptFolderEntry.committed.categoryOrder)
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

/** Builds a renderer revision envelope for one category. */
export const buildCategorySnapshot = (
  categoryEntry: CategoryCommittedEntry
): RevisionEnvelope<Category> => ({
  id: categoryEntry.committed.id,
  revision: categoryEntry.revision,
  data: categoryEntry.committed
})
