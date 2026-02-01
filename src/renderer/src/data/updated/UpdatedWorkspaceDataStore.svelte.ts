import type { UpdatedWorkspaceData as WorkspaceData } from '@shared/ipc/updatedTypes'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const workspaceStore = createBaseDataStore<WorkspaceData>()

export const getWorkspaceEntry = (workspaceId: string) =>
  workspaceStore.getEntry(workspaceId)

export const optimisticInsertWorkspaceDraft = (draft: WorkspaceData): string => {
  const workspaceId = crypto.randomUUID()
  workspaceStore.optimisticInsert(draft, workspaceId)
  return workspaceId
}

export const optimisticDeleteWorkspaceDraft = (workspaceId: string): void => {
  workspaceStore.optimisticDelete(workspaceId)
}

export const applyFetchWorkspace = (
  workspaceId: string,
  data: WorkspaceData,
  revision: number
): void => {
  workspaceStore.mergeAuthoritativeSnapshot(workspaceId, { data, revision })
}

export const mergeAuthoritativeWorkspaceSnapshot = (
  workspaceId: string,
  data: WorkspaceData,
  revision: number,
  conflict = false
): void => {
  workspaceStore.mergeAuthoritativeSnapshot(workspaceId, { data, revision }, conflict)
}
