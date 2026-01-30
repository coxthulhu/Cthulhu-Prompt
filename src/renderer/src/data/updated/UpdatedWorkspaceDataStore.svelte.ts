import type { UpdatedWorkspaceData } from '@shared/ipc'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const workspaceStore = createUpdatedBaseDataStore<UpdatedWorkspaceData>()

export const getUpdatedWorkspaceEntry = (workspaceId: string) =>
  workspaceStore.getEntry(workspaceId)

export const optimisticInsertUpdatedWorkspaceDraft = (draft: UpdatedWorkspaceData): string => {
  const workspaceId = crypto.randomUUID()
  const nextDraft: UpdatedWorkspaceData = { ...draft, workspaceId }
  workspaceStore.optimisticInsert(nextDraft, workspaceId)
  return workspaceId
}

export const commitUpdatedWorkspaceDraftInsert = (
  draftId: string,
  nextId: string,
  data: UpdatedWorkspaceData,
  revision: number
): void => {
  workspaceStore.commitDraftInsert(draftId, nextId, { data, revision })
}

export const optimisticDeleteUpdatedWorkspaceDraft = (workspaceId: string): void => {
  workspaceStore.optimisticDelete(workspaceId)
}

export const revertUpdatedWorkspaceDraftFromBase = (workspaceId: string): void => {
  workspaceStore.revertDraftFromBase(workspaceId)
}

export const commitUpdatedWorkspaceDeletion = (workspaceId: string): void => {
  workspaceStore.commitDeletion(workspaceId)
}

export const applyFetchUpdatedWorkspace = (
  workspaceId: string,
  data: UpdatedWorkspaceData,
  revision: number
): void => {
  workspaceStore.applyFetch(workspaceId, { data, revision })
}

export const applyOptimisticUpdatedWorkspace = (
  workspaceId: string,
  data: UpdatedWorkspaceData,
  revision: number
): void => {
  workspaceStore.applyOptimisticChanges(workspaceId, { data, revision })
}
