import { produce } from 'immer'

type CommittedEntry<TData, TFileFields> = {
  revision: number
  committed: TData | null
  fileFields: TFileFields | null
}

export type CommittedStore<TData, TFileFields> = {
  getRevision: (id: string) => number
  getCommitted: (id: string) => TData | null
  getFileFields: (id: string) => TFileFields | null
  // Use this after initial disk reads.
  setFromDisk: (id: string, data: TData, fileFields?: TFileFields) => void
  // Use this after disk writes succeed.
  commitAfterWrite: (id: string, data: TData) => number
  remove: (id: string) => void
}

export const createCommittedStore = <TData, TFileFields>(): CommittedStore<TData, TFileFields> => {
  let entriesById: Record<string, CommittedEntry<TData, TFileFields>> = {}

  return {
    getRevision: (id) => entriesById[id]?.revision ?? 0,
    getCommitted: (id) => entriesById[id]?.committed ?? null,
    getFileFields: (id) => entriesById[id]?.fileFields ?? null,
    setFromDisk: (id, data, fileFields) => {
      entriesById = produce(entriesById, () => {
        const nextEntry: CommittedEntry<TData, TFileFields> = {
          revision: 0,
          committed: data,
          fileFields: fileFields ?? entriesById[id]?.fileFields ?? null
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
        const nextEntry: CommittedEntry<TData, TFileFields> = {
          revision: nextRevision,
          committed: data,
          fileFields: entriesById[id]?.fileFields ?? null
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
