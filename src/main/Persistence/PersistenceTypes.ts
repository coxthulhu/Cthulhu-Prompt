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

export type PersistenceStageResult<TPersistenceFields, TStagedChange> =
  {
    stagedChange: TStagedChange
    nextPersistenceFields?: TPersistenceFields
  }

export type PersistenceLayer<TData, TPersistenceFields, TStagedChange = unknown> = {
  stageChanges: (
    change: PersistenceChange<TData, TPersistenceFields>
  ) => Promise<PersistenceStageResult<TPersistenceFields, TStagedChange>>
  commitChanges: (stagedChange: TStagedChange) => Promise<void>
  revertChanges: (stagedChange: TStagedChange) => Promise<void>
  loadData: (persistenceFields: TPersistenceFields) => Promise<TData | null>
}

export const createPersistenceStageResult = <TPersistenceFields, TStagedChange>(
  stagedChange: TStagedChange,
  nextPersistenceFields?: TPersistenceFields
): PersistenceStageResult<TPersistenceFields, TStagedChange> => {
  if (nextPersistenceFields === undefined) {
    return { stagedChange }
  }

  return {
    stagedChange,
    nextPersistenceFields
  }
}
