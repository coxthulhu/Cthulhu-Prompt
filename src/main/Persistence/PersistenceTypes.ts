import type { FilePersistenceStagedChange } from './FilePersistenceHelpers'

export type PersistenceChange<TData, TPersistenceFields> =
  | {
      type: 'upsert'
      persistenceFields: TPersistenceFields
      data: TData
    }
  | {
      type: 'remove'
      persistenceFields: TPersistenceFields
    }

export type PersistenceStageResult<TPersistenceFields> = {
  stagedChange: FilePersistenceStagedChange[]
  nextPersistenceFields?: TPersistenceFields
}

export type PersistenceLayer<TData, TPersistenceFields> = {
  stageChanges: (
    change: PersistenceChange<TData, TPersistenceFields>
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
