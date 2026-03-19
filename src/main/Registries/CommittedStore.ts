import { produce } from 'immer'

type CommittedEntry<TData, TPersistenceFields> = {
  revision: number
  committed: TData | null
  persistenceFields: TPersistenceFields | null
}

export type CommittedStore<TData, TPersistenceFields> = {
  getRevision: (id: string) => number
  getCommitted: (id: string) => TData | null
  getPersistenceFields: (id: string) => TPersistenceFields | null
  // Use this after initial disk reads.
  setFromDisk: (id: string, data: TData, persistenceFields?: TPersistenceFields) => void
  // Use this after disk writes succeed.
  commitAfterWrite: (id: string, data: TData) => number
  remove: (id: string) => void
}

export const createCommittedStore = <
  TData,
  TPersistenceFields
>(): CommittedStore<TData, TPersistenceFields> => {
  let entriesById: Record<string, CommittedEntry<TData, TPersistenceFields>> = {}

  return {
    getRevision: (id) => entriesById[id]?.revision ?? 0,
    getCommitted: (id) => entriesById[id]?.committed ?? null,
    getPersistenceFields: (id) => entriesById[id]?.persistenceFields ?? null,
    setFromDisk: (id, data, persistenceFields) => {
      entriesById = produce(entriesById, () => {
        const nextEntry: CommittedEntry<TData, TPersistenceFields> = {
          revision: 0,
          committed: data,
          persistenceFields: persistenceFields ?? entriesById[id]?.persistenceFields ?? null
        }

        return {
          ...entriesById,
          [id]: nextEntry
        }
      })
    },
    commitAfterWrite: (id, data) => {
      const nextRevision = (entriesById[id]?.revision ?? 0) + 1

      entriesById = produce(entriesById, () => {
        const nextEntry: CommittedEntry<TData, TPersistenceFields> = {
          revision: nextRevision,
          committed: data,
          persistenceFields: entriesById[id]?.persistenceFields ?? null
        }

        return {
          ...entriesById,
          [id]: nextEntry
        }
      })

      return nextRevision
    },
    remove: (id) => {
      entriesById = produce(entriesById, (draft) => {
        delete draft[id]
      })
    }
  }
}
