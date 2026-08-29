import { produce, type Draft } from 'immer'
import type {
  DomainChange,
  DomainEntityMap,
  DomainEntityType
} from '@shared/DomainChanges'
import type { PromptFolder } from '@shared/PromptFolder'
import type { CommittedEntry } from '../Data/CommittedStore'
import { data } from '../Data/Data'
import type { PersistenceChange } from './PersistenceTypes'

/** Untyped committed entry used only behind the entity-type dispatch boundary. */
export type AnyCommittedEntry = CommittedEntry<unknown, unknown>

/** Domain entity projected after all recipe-based changes have been applied. */
type ProjectedDomainEntity = {
  entityType: DomainEntityType
  id: string
  data: DomainEntityMap[DomainEntityType]
}

/** Shared projected state and output used by entity-specific persistence planners. */
export type DomainPersistencePlanningContext = {
  changes: readonly DomainChange[]
  projectedPromptFolders: readonly PromptFolder[]
  persistenceChanges: Map<string, PersistenceChange>
  getCommittedEntry: (entityType: DomainEntityType, id: string) => AnyCommittedEntry | null
  getProjectedOrCommittedData: <TEntityType extends DomainEntityType>(
    entityType: TEntityType,
    id: string
  ) => DomainEntityMap[TEntityType] | undefined
}

/** Builds the stable map key for one planned persistence entity. */
export const buildDomainPersistenceKey = (
  entityType: DomainEntityType,
  id: string
): string => `${entityType}:${id}`

/** Reads one committed entry from the data store selected by domain entity type. */
const getCommittedEntry = (
  entityType: DomainEntityType,
  id: string
): AnyCommittedEntry | null =>
  data[entityType].committedStore.getEntry(id) as AnyCommittedEntry | null

/** Reads every committed entry from the data store selected by domain entity type. */
const getAllCommittedEntries = (entityType: DomainEntityType): AnyCommittedEntry[] =>
  data[entityType].committedStore.getAllEntries() as AnyCommittedEntry[]

/** Applies domain recipes to committed data without changing authoritative stores. */
const projectDomainChanges = (
  changes: readonly DomainChange[]
): Map<string, ProjectedDomainEntity> => {
  /** Projected entity values keyed by domain target. */
  const projectedEntities = new Map<string, ProjectedDomainEntity>()

  for (const change of changes) {
    if (change.type === 'delete') continue
    /** Next domain data created directly or by applying the shared Immer recipe. */
    const nextData =
      change.type === 'insert'
        ? change.data
        : (() => {
            /** Current main-process entity required by an update recipe. */
            const currentEntry = getCommittedEntry(change.entityType, change.id)
            if (!currentEntry) {
              throw new Error(
                `Domain persistence target not loaded: ${change.entityType}:${change.id}`
              )
            }
            return produce(
              currentEntry.committed as DomainEntityMap[DomainEntityType],
              change.recipe as unknown as (
                draft: Draft<DomainEntityMap[DomainEntityType]>
              ) => void
            ) as DomainEntityMap[DomainEntityType]
          })()
    projectedEntities.set(buildDomainPersistenceKey(change.entityType, change.id), {
      entityType: change.entityType,
      id: change.id,
      data: nextData
    })
  }

  return projectedEntities
}

/** Creates baseline persistence writes for every domain mutation target. */
const createTargetPersistenceChanges = (
  changes: readonly DomainChange[],
  projectedEntities: Map<string, ProjectedDomainEntity>
): Map<string, PersistenceChange> => {
  /** Persistence changes keyed by entity target for later planner refinement. */
  const persistenceChanges = new Map<string, PersistenceChange>()

  for (const change of changes) {
    /** Current committed entry and persistence metadata for this target. */
    const currentEntry = getCommittedEntry(change.entityType, change.id)
    if (change.type === 'insert') {
      throw new Error(`Domain insert persistence is not configured for ${change.entityType}`)
    }
    if (!currentEntry) {
      throw new Error(`Domain persistence target not loaded: ${change.entityType}:${change.id}`)
    }

    /** Stable target key shared with projected-domain lookup. */
    const targetKey = buildDomainPersistenceKey(change.entityType, change.id)
    if (change.type === 'delete') {
      persistenceChanges.set(targetKey, {
        type: 'remove',
        entityType: change.entityType,
        id: change.id,
        persistenceFields: currentEntry.persistenceFields
      } as PersistenceChange)
      continue
    }

    /** Projected full main-process data persisted for this domain update. */
    const nextData = projectedEntities.get(targetKey)!.data
    persistenceChanges.set(targetKey, {
      type: 'upsert',
      entityType: change.entityType,
      id: change.id,
      data: nextData,
      persistenceFields: currentEntry.persistenceFields
    } as PersistenceChange)
  }

  return persistenceChanges
}

/** Builds the shared projection and baseline writes for one domain persistence plan. */
export const createDomainPersistencePlanningContext = (
  changes: readonly DomainChange[]
): DomainPersistencePlanningContext => {
  /** Projected authoritative entities after applying shared domain recipes. */
  const projectedEntities = projectDomainChanges(changes)
  /** Reads projected data when changed and committed data otherwise. */
  const getProjectedOrCommittedData = <TEntityType extends DomainEntityType>(
    entityType: TEntityType,
    id: string
  ): DomainEntityMap[TEntityType] | undefined => {
    /** Projected data for an entity changed by this mutation. */
    const projected = projectedEntities.get(buildDomainPersistenceKey(entityType, id))
    if (projected) return projected.data as DomainEntityMap[TEntityType]
    return getCommittedEntry(entityType, id)?.committed as
      | DomainEntityMap[TEntityType]
      | undefined
  }
  /** Projected folder graph used for ownership and filename planning. */
  const projectedPromptFolders = getAllCommittedEntries('promptFolder').map((entry) => {
    /** Committed folder ID used to locate an optional projection. */
    const promptFolderId = (entry.committed as PromptFolder).id
    return getProjectedOrCommittedData('promptFolder', promptFolderId)!
  })

  return {
    changes,
    projectedPromptFolders,
    persistenceChanges: createTargetPersistenceChanges(changes, projectedEntities),
    getCommittedEntry,
    getProjectedOrCommittedData
  }
}
