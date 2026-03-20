export type CommittedEntry<TData, TPersistenceFields> = {
  revision: number
  committed: TData
  persistenceFields: TPersistenceFields
}

export type CommittedStore<TData, TPersistenceFields> = {
  getRevision: (id: string) => number
  getEntry: (id: string) => CommittedEntry<TData, TPersistenceFields> | null
  // Use this after initial disk reads.
  setFromDisk: (id: string, data: TData, persistenceFields: TPersistenceFields) => void
  // Use this after disk writes succeed.
  commitAfterWrite: (id: string, data: TData, persistenceFields?: TPersistenceFields) => number
  remove: (id: string) => void
}

export const createCommittedStore = <
  TData,
  TPersistenceFields
>(): CommittedStore<TData, TPersistenceFields> => {
  let entriesById: Record<string, CommittedEntry<TData, TPersistenceFields>> = {}

  const upsertEntry = (
    id: string,
    entry: CommittedEntry<TData, TPersistenceFields>
  ): void => {
    entriesById = {
      ...entriesById,
      [id]: entry
    }
  }

  return {
    getRevision: (id) => entriesById[id]?.revision ?? 0,
    getEntry: (id) => entriesById[id] ?? null,
    setFromDisk: (id, data, persistenceFields) => {
      upsertEntry(id, {
        revision: 0,
        committed: data,
        persistenceFields
      })
    },
    commitAfterWrite: (id, data, persistenceFields) => {
      const existingEntry = entriesById[id]!
      const nextRevision = existingEntry.revision + 1
      const nextPersistenceFields =
        persistenceFields === undefined ? existingEntry.persistenceFields : persistenceFields

      upsertEntry(id, {
        revision: nextRevision,
        committed: data,
        persistenceFields: nextPersistenceFields
      })

      return nextRevision
    },
    remove: (id) => {
      const { [id]: _removed, ...remainingEntries } = entriesById
      entriesById = remainingEntries
    }
  }
}
