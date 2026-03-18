import { produce } from 'immer'
import type { PromptPersisted } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { SystemSettings } from '@shared/SystemSettings'
import type { Workspace } from '@shared/Workspace'

type CommittedRevisionEntry<TData> = {
  revision: number
  committed: TData
}

type CommittedRevisionStore<TData> = {
  getRevision: (id: string) => number
  getCommitted: (id: string) => TData | null
  // Use this after initial disk reads.
  setFromDisk: (id: string, data: TData) => void
  // Use this after disk writes succeed.
  commitAfterWrite: (id: string, data: TData) => number
  remove: (id: string) => void
}

const createCommittedRevisionStore = <TData>(): CommittedRevisionStore<TData> => {
  let entriesById: Record<string, CommittedRevisionEntry<TData>> = {}

  return {
    getRevision: (id) => entriesById[id]?.revision ?? 0,
    getCommitted: (id) => entriesById[id]?.committed ?? null,
    setFromDisk: (id, data) => {
      entriesById = produce(entriesById, (draft) => {
        draft[id] = {
          revision: 0,
          committed: data as (typeof draft)[string]['committed']
        }
      })
    },
    commitAfterWrite: (id, data) => {
      let nextRevision = 0
      entriesById = produce(entriesById, (draft) => {
        nextRevision = (draft[id]?.revision ?? 0) + 1
        draft[id] = {
          revision: nextRevision,
          committed: data as (typeof draft)[string]['committed']
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

export const committedRevisions = {
  systemSettings: createCommittedRevisionStore<SystemSettings>(),
  workspace: createCommittedRevisionStore<Workspace>(),
  promptFolder: createCommittedRevisionStore<PromptFolder>(),
  prompt: createCommittedRevisionStore<PromptPersisted>()
}
