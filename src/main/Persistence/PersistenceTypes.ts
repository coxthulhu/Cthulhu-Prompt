import type { DomainEntityType } from '@shared/domain/DomainChanges'

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

/** Workspace records and preferences are addressed by stable entity ID. */
export type DomainPersistenceFieldsMap = Record<DomainEntityType, Record<string, never>>

/** SQLite persistence queried by authoritative ID and changed through one database command. */
export type SqlitePersistenceLayer<TData, TPersistenceFields> = {
  kind: 'sqlite'
  query: (id: string, persistenceFields: TPersistenceFields) => TData | null
  command: (
    id: string,
    transition: PersistenceTransition<TData, TPersistenceFields>
  ) => void
}

/** Every revisioned domain store now uses SQLite. */
export type PersistenceLayer<TData, TFields> = SqlitePersistenceLayer<TData, TFields>
