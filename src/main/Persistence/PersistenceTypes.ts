export type PersistenceLayer<TData, TPersistenceFields> = {
  persistData: (persistenceFields: TPersistenceFields, data: TData) => Promise<void>
  loadData: (persistenceFields: TPersistenceFields) => Promise<TData | null>
  removeData: (persistenceFields: TPersistenceFields) => Promise<void>
}
