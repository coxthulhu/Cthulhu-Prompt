import type { UpdatedWorkspaceData as WorkspaceData } from '@shared/ipc'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const workspaceStore = createBaseDataStore<WorkspaceData>()

export const getWorkspaceEntry = (workspaceId: string) =>
  workspaceStore.getEntry(workspaceId)

export const optimisticInsertWorkspaceDraft = (draft: WorkspaceData): string => {
  const workspaceId = crypto.randomUUID()
  const nextDraft: WorkspaceData = { ...draft, workspaceId }
  workspaceStore.optimisticInsert(nextDraft, workspaceId)
  return workspaceId
}

export const commitWorkspaceDraftInsert = (
  draftId: string,
  nextId: string,
  data: WorkspaceData,
  revision: number
): void => {
  workspaceStore.commitDraftInsert(draftId, nextId, { data, revision })
}

export const optimisticDeleteWorkspaceDraft = (workspaceId: string): void => {
  workspaceStore.optimisticDelete(workspaceId)
}

export const revertWorkspaceDraftFromBase = (workspaceId: string): void => {
  workspaceStore.revertDraftFromBase(workspaceId)
}

export const commitWorkspaceDeletion = (workspaceId: string): void => {
  workspaceStore.commitDeletion(workspaceId)
}

export const applyFetchWorkspace = (
  workspaceId: string,
  data: WorkspaceData,
  revision: number
): void => {
  workspaceStore.applyFetch(workspaceId, { data, revision })
}

export const applyOptimisticUpdatedWorkspace = (
  workspaceId: string,
  data: WorkspaceData,
  revision: number
): void => {
  workspaceStore.applyOptimisticChanges(workspaceId, { data, revision })
}
