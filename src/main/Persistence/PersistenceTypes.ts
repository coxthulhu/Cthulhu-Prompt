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

export type PersistenceLayer<TData, TPersistenceFields, TStagedChange = unknown> = {
  stageChanges: (change: PersistenceChange<TData, TPersistenceFields>) => Promise<TStagedChange>
  commitChanges: (stagedChange: TStagedChange) => Promise<void>
  revertChanges: (stagedChange: TStagedChange) => Promise<void>
  loadData: (persistenceFields: TPersistenceFields) => Promise<TData | null>
}
