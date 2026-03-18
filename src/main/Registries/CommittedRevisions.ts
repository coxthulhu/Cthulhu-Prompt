import { produce } from 'immer'
import type { PromptPersisted } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { SystemSettings } from '@shared/SystemSettings'
import type { Workspace } from '@shared/Workspace'

type CommittedRevisionEntry<TData, TFileFields> = {
  revision: number
  committed: TData | null
  fileFields: TFileFields | null
}

type CommittedRevisionStore<TData, TFileFields> = {
  getRevision: (id: string) => number
  getCommitted: (id: string) => TData | null
  // Use this after initial disk reads.
  setFromDisk: (id: string, data: TData, fileFields?: TFileFields) => void
  // Use this after disk writes succeed.
  commitAfterWrite: (id: string, data: TData) => number
  remove: (id: string) => void
}

type WorkspaceFileFields = {
  workspacePath: string
}

type PromptFolderFileFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
}

type PromptFileFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  promptFolderId: string
}

const createCommittedRevisionStore = <TData, TFileFields>(): CommittedRevisionStore<
  TData,
  TFileFields
> => {
  let entriesById: Record<string, CommittedRevisionEntry<TData, TFileFields>> = {}

  return {
    getRevision: (id) => entriesById[id]?.revision ?? 0,
    getCommitted: (id) => entriesById[id]?.committed ?? null,
    setFromDisk: (id, data, fileFields) => {
      entriesById = produce(entriesById, () => {
        const nextFileFields = fileFields ?? entriesById[id]?.fileFields ?? null
        const nextEntry: CommittedRevisionEntry<TData, TFileFields> = {
          revision: 0,
          committed: data,
          fileFields: nextFileFields
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
        const existingFileFields = entriesById[id]?.fileFields ?? null
        const nextEntry: CommittedRevisionEntry<TData, TFileFields> = {
          revision: nextRevision,
          committed: data,
          fileFields: existingFileFields
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

export const committedRevisions = {
  systemSettings: createCommittedRevisionStore<SystemSettings, never>(),
  workspace: createCommittedRevisionStore<Workspace, WorkspaceFileFields>(),
  promptFolder: createCommittedRevisionStore<PromptFolder, PromptFolderFileFields>(),
  prompt: createCommittedRevisionStore<PromptPersisted, PromptFileFields>()
}
