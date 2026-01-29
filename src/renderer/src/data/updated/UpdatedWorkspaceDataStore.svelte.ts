import { SvelteMap } from 'svelte/reactivity'

import type { UpdatedWorkspaceData } from '@shared/ipc'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const workspaceStore = createUpdatedBaseDataStore<UpdatedWorkspaceData>()
const workspaceIdByPath = new SvelteMap<string, string>()

const trackWorkspacePath = (workspaceId: string, data: UpdatedWorkspaceData): void => {
  workspaceIdByPath.set(data.workspacePath, workspaceId)
}

export const getUpdatedWorkspaceEntry = (workspaceId: string) =>
  workspaceStore.getEntry(workspaceId)

export const getUpdatedWorkspaceIdForPath = (workspacePath: string): string | null =>
  workspaceIdByPath.get(workspacePath) ?? null

export const insertUpdatedWorkspaceDraft = (draft: UpdatedWorkspaceData): string => {
  const workspaceId = crypto.randomUUID()
  const nextDraft: UpdatedWorkspaceData = { ...draft, workspaceId }
  workspaceStore.insertDraft(nextDraft, workspaceId)
  trackWorkspacePath(workspaceId, nextDraft)
  return workspaceId
}

export const commitUpdatedWorkspaceDraftInsert = (
  draftId: string,
  nextId: string,
  data: UpdatedWorkspaceData,
  revision: number
): void => {
  workspaceStore.commitDraftInsert(draftId, nextId, { data, revision })
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

export const revertUpdatedWorkspaceDraftFromBase = (workspaceId: string): void => {
  const entry = workspaceStore.getEntry(workspaceId)!
  workspaceStore.revertDraftFromBase(workspaceId)
  if (entry.baseSnapshot) {
    trackWorkspacePath(workspaceId, entry.baseSnapshot.data)
  }
}

export const commitUpdatedWorkspaceDeletion = (workspaceId: string): void => {
  const entry = workspaceStore.getEntry(workspaceId)!
  const workspacePath =
    entry.baseSnapshot?.data.workspacePath ?? entry.draftSnapshot?.workspacePath ?? null

  workspaceStore.commitDeletion(workspaceId)

  if (workspacePath) {
    workspaceIdByPath.delete(workspacePath)
  }
}

export const applyFetchUpdatedWorkspace = (
  workspaceId: string,
  data: UpdatedWorkspaceData,
  revision: number
): void => {
  workspaceStore.applyFetch(workspaceId, { data, revision })
  trackWorkspacePath(workspaceId, data)
}

export const applyOptimisticUpdatedWorkspace = (
  workspaceId: string,
  data: UpdatedWorkspaceData,
  revision: number
): void => {
  workspaceStore.applyOptimisticChanges(workspaceId, { data, revision })
  trackWorkspacePath(workspaceId, data)
}
