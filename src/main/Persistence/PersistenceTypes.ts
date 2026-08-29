import type { FilePersistenceStagedChange } from './FilePersistenceHelpers'
import type { CategoryPersistenceFields } from './CategoryPersistence'
import type { PromptFolderPersistenceFields } from './PromptFolderPersistence'
import type { PromptPersistenceFields } from './PromptPersistence'
import type { PromptTemplatePersistenceFields } from './PromptTemplatePersistence'
import type { SystemSettingsPersistenceFields } from './SystemSettingsPersistence'
import type { WorkspacePersistenceFields } from './WorkspacePersistence'

/** One present persisted record on either side of a storage transition. */
export type PersistenceRecord<TData, TPersistenceFields> = {
  data: TData
  persistenceFields: TPersistenceFields
}

/** Explicit current and desired records supplied to an entity persistence layer. */
export type PersistenceTransition<TData, TPersistenceFields> = {
  before: PersistenceRecord<TData, TPersistenceFields> | null
  after: PersistenceRecord<TData, TPersistenceFields> | null
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

export type PersistenceStageResult<TPersistenceFields> = {
  stagedChange: FilePersistenceStagedChange[]
  nextPersistenceFields?: TPersistenceFields
}

export type PersistenceLayer<TData, TPersistenceFields> = {
  stageChanges: (
    transition: PersistenceTransition<TData, TPersistenceFields>
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
