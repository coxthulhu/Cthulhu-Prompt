import { SvelteMap } from 'svelte/reactivity'

import type { WorkspaceData } from '@shared/ipc'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'
import { refetchUpdatedWorkspaceById } from './ipc/workspaceIpc'

const workspaceStore = createUpdatedBaseDataStore<WorkspaceData>()
const workspaceIdByPath = new SvelteMap<string, string>()

const trackWorkspacePath = (workspaceId: string, data: WorkspaceData): void => {
  workspaceIdByPath.set(data.workspacePath, workspaceId)
}

export const getUpdatedWorkspaceEntry = (workspaceId: string) =>
  workspaceStore.getEntry(workspaceId)

export const getUpdatedWorkspaceIdForPath = (workspacePath: string): string | null =>
  workspaceIdByPath.get(workspacePath) ?? null

export const insertUpdatedWorkspaceDraft = (draft: WorkspaceData): string => {
  const workspaceId = crypto.randomUUID()
  const nextDraft: WorkspaceData = { ...draft, workspaceId }
  workspaceStore.insertDraft(nextDraft, workspaceId)
  trackWorkspacePath(workspaceId, nextDraft)
  return workspaceId
}

export const completeUpdatedWorkspaceDraftInsert = (
  draftId: string,
  nextId: string,
  data: WorkspaceData,
  revision: number
): void => {
  workspaceStore.completeDraftInsert(draftId, nextId, { data, revision })
  trackWorkspacePath(nextId, data)
}

export const deleteUpdatedWorkspaceDraft = (workspaceId: string): void => {
  const entry = workspaceStore.getEntry(workspaceId)!
  const workspacePath =
    entry.baseSnapshot?.data.workspacePath ?? entry.draftSnapshot?.workspacePath ?? null

  workspaceStore.deleteDraft(workspaceId)

  if (!workspaceStore.getEntry(workspaceId) && workspacePath) {
    workspaceIdByPath.delete(workspacePath)
  }
}

export const restoreUpdatedWorkspaceDraftFromBase = (workspaceId: string): void => {
  const entry = workspaceStore.getEntry(workspaceId)!
  workspaceStore.restoreDraftFromBase(workspaceId)
  if (entry.baseSnapshot) {
    trackWorkspacePath(workspaceId, entry.baseSnapshot.data)
  }
}

export const completeUpdatedWorkspaceDeletion = (workspaceId: string): void => {
  const entry = workspaceStore.getEntry(workspaceId)!
  const workspacePath =
    entry.baseSnapshot?.data.workspacePath ?? entry.draftSnapshot?.workspacePath ?? null

  workspaceStore.completeDeletion(workspaceId)

  if (workspacePath) {
    workspaceIdByPath.delete(workspacePath)
  }
}

export const applyFetchUpdatedWorkspace = (
  workspaceId: string,
  data: WorkspaceData,
  revision: number
): void => {
  workspaceStore.applyFetch(workspaceId, { data, revision })
  trackWorkspacePath(workspaceId, data)
}

export const syncUpdatedWorkspace = (
  workspaceId: string,
  data: WorkspaceData,
  revision: number
): void => {
  workspaceStore.applySync(workspaceId, { data, revision })
  trackWorkspacePath(workspaceId, data)
}

export const refetchUpdatedWorkspace = (workspaceId: string): Promise<void> =>
  refetchUpdatedWorkspaceById(workspaceId, applyFetchUpdatedWorkspace)
