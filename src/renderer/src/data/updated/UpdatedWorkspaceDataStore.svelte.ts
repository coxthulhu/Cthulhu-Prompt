import type { ResponseData, UpdatedWorkspaceData as WorkspaceData } from '@shared/ipc/updatedTypes'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const workspaceStore = createBaseDataStore<WorkspaceData>()

export const getWorkspaceEntry = (workspaceId: string) =>
  workspaceStore.getEntry(workspaceId)

export const optimisticInsertWorkspaceDraft = (draft: WorkspaceData): string => {
  return workspaceStore.optimisticInsert(draft)
}

export const optimisticDeleteWorkspaceDraft = (workspaceId: string): void => {
  workspaceStore.optimisticDelete(workspaceId)
}

// After rekeying, mergeAuthoritativeWorkspaceSnapshot(response.id, response.data, response.revision).
export const rekeyWorkspaceEntry = (
  response: ResponseData<WorkspaceData>,
  rewriteReferences: (oldWorkspaceId: string, newWorkspaceId: string) => void
): void => {
  workspaceStore.rekeyEntry(response.clientTempId!, response.id, rewriteReferences)
}

export const mergeAuthoritativeWorkspaceSnapshot = (
  workspaceId: string,
  data: WorkspaceData,
  revision: number,
  conflict = false
): void => {
  workspaceStore.mergeAuthoritativeSnapshot(workspaceId, { data, revision }, conflict)
}
