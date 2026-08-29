import type { DomainEntityMap, DomainEntityType } from '@shared/DomainChanges'
import type { FilePersistenceStagedChange } from './FilePersistenceHelpers'
import type { CategoryPersistenceFields } from './CategoryPersistence'
import type { PromptFolderPersistenceFields } from './PromptFolderPersistence'
import type { PromptPersistenceFields } from './PromptPersistence'
import type { PromptTemplatePersistenceFields } from './PromptTemplatePersistence'
import type { SystemSettingsPersistenceFields } from './SystemSettingsPersistence'
import type { WorkspacePersistenceFields } from './WorkspacePersistence'

/** Low-level write supplied to one entity-specific persistence layer. */
export type PersistenceWrite<TData, TPersistenceFields> =
  | {
      type: 'upsert'
      persistenceFields: TPersistenceFields
      data: TData
    }
  | {
      type: 'remove'
      persistenceFields: TPersistenceFields
    }

/** Persistence metadata associated with each authoritative domain entity type. */
export type DomainPersistenceFieldsMap = {
  systemSettings: SystemSettingsPersistenceFields
  workspace: WorkspacePersistenceFields
  promptFolder: PromptFolderPersistenceFields
  category: CategoryPersistenceFields
  prompt: PromptPersistenceFields
  promptTemplate: PromptTemplatePersistenceFields
}

/** One typed persistence change associated with an authoritative entity ID. */
export type PersistenceChangeFor<TEntityType extends DomainEntityType> = {
  entityType: TEntityType
  id: string
} & PersistenceWrite<DomainEntityMap[TEntityType], DomainPersistenceFieldsMap[TEntityType]>

/** Strongly typed persistence change union produced by the main mutation framework. */
export type PersistenceChange = {
  [TEntityType in DomainEntityType]: PersistenceChangeFor<TEntityType>
}[DomainEntityType]

export type PersistenceStageResult<TPersistenceFields> = {
  stagedChange: FilePersistenceStagedChange[]
  nextPersistenceFields?: TPersistenceFields
}

export type PersistenceLayer<TData, TPersistenceFields> = {
  stageChanges: (
    change: PersistenceWrite<TData, TPersistenceFields>
  ) => Promise<PersistenceStageResult<TPersistenceFields>>
  commitChanges: (stagedChange: FilePersistenceStagedChange[]) => Promise<void>
  revertChanges: (stagedChange: FilePersistenceStagedChange[]) => Promise<void>
  loadData: (persistenceFields: TPersistenceFields) => Promise<TData | null>
}

export const createPersistenceStageResult = <TPersistenceFields>(
  stagedChange: FilePersistenceStagedChange[],
  nextPersistenceFields?: TPersistenceFields
): PersistenceStageResult<TPersistenceFields> => {
  if (nextPersistenceFields === undefined) {
    return { stagedChange }
  }

  return {
    stagedChange,
    nextPersistenceFields
  }
}
