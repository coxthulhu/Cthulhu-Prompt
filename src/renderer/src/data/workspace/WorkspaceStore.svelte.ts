import { SvelteMap } from 'svelte/reactivity'

import type {
  LoadWorkspaceDataRequest,
  LoadWorkspaceDataResult,
  PromptFolder,
  UpdateWorkspaceDataRequest,
  UpdateWorkspaceDataResult,
  WorkspaceData
} from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import { sanitizePromptFolderName } from '@shared/promptFolderName'
import {
  createVersionedDataStore,
  type VersionedDataState,
  type VersionedSaveOutcome,
  type VersionedSnapshot,
  toVersionedSaveResult
} from '@renderer/data/versioned/VersionedDataStore'

export type WorkspaceDraft = WorkspaceData
export type WorkspaceState = VersionedDataState<WorkspaceDraft, WorkspaceData>

export type WorkspaceStoreState = {
  workspacePath: string | null
  dataState: WorkspaceState | null
  isLoading: boolean
  errorMessage: string | null
  requestId: number
}

const activeWorkspaceState = $state<WorkspaceStoreState>({
  workspacePath: null,
  dataState: null,
  isLoading: false,
  errorMessage: null,
  requestId: 0
})

const workspaceStatesById = new SvelteMap<string, WorkspaceState>()
const workspaceIdByPath = new SvelteMap<string, string>()
let nextRequestId = 0

const cloneFolders = (folders: PromptFolder[]): PromptFolder[] =>
  folders.map((folder) => ({ ...folder }))

const createSnapshot = (
  data: WorkspaceData,
  version: number
): VersionedSnapshot<WorkspaceData> => ({
  data: {
    workspaceId: data.workspaceId,
    workspacePath: data.workspacePath,
    folders: cloneFolders(data.folders)
  },
  version
})

const createDraft = (snapshot: VersionedSnapshot<WorkspaceData>): WorkspaceDraft => ({
  workspaceId: snapshot.data.workspaceId,
  workspacePath: snapshot.data.workspacePath,
  folders: cloneFolders(snapshot.data.folders)
})

const areFoldersEqual = (left: PromptFolder[], right: PromptFolder[]): boolean => {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftFolder = left[index]
    const rightFolder = right[index]

    if (
      leftFolder.folderName !== rightFolder.folderName ||
      leftFolder.displayName !== rightFolder.displayName
    ) {
      return false
    }
  }

  return true
}

const isDraftDirty = (
  draft: WorkspaceDraft,
  snapshot: VersionedSnapshot<WorkspaceData>
): boolean => {
  if (draft.workspaceId !== snapshot.data.workspaceId) {
    return true
  }

  if (draft.workspacePath !== snapshot.data.workspacePath) {
    return true
  }

  return !areFoldersEqual(draft.folders, snapshot.data.folders)
}

const workspaceDataStore = createVersionedDataStore<WorkspaceDraft, WorkspaceData>({
  createDraft,
  isDraftDirty
})

const isLatestRequest = (workspacePath: string, requestId: number): boolean =>
  activeWorkspaceState.workspacePath === workspacePath &&
  activeWorkspaceState.requestId === requestId

const replaceWorkspaceState = (
  workspaceId: string,
  snapshot: VersionedSnapshot<WorkspaceData>
): WorkspaceState => {
  const nextState = workspaceDataStore.createState(snapshot)
  workspaceStatesById.set(workspaceId, nextState)
  workspaceIdByPath.set(snapshot.data.workspacePath, workspaceId)

  if (activeWorkspaceState.workspacePath === snapshot.data.workspacePath) {
    activeWorkspaceState.dataState = nextState
  }

  return nextState
}

export const getActiveWorkspaceState = (): WorkspaceStoreState => activeWorkspaceState

export const setActiveWorkspacePath = async (workspacePath: string | null): Promise<void> => {
  activeWorkspaceState.workspacePath = workspacePath
  activeWorkspaceState.errorMessage = null

  if (!workspacePath) {
    activeWorkspaceState.dataState = null
    activeWorkspaceState.isLoading = false
    activeWorkspaceState.requestId = 0
    return
  }

  const requestId = (nextRequestId += 1)
  activeWorkspaceState.requestId = requestId
  activeWorkspaceState.isLoading = true

  const cachedWorkspaceId = workspaceIdByPath.get(workspacePath) ?? null
  const cachedState = cachedWorkspaceId ? workspaceStatesById.get(cachedWorkspaceId) ?? null : null
  activeWorkspaceState.dataState = cachedState

  try {
    const result = await ipcInvoke<LoadWorkspaceDataResult, LoadWorkspaceDataRequest>(
      'load-workspace-data',
      {
        workspacePath
      }
    )

    if (!isLatestRequest(workspacePath, requestId)) {
      return
    }

    const snapshot = createSnapshot(result.workspace!, result.version!)
    replaceWorkspaceState(result.workspace!.workspaceId, snapshot)
    activeWorkspaceState.isLoading = false
  } catch (error) {
    if (!isLatestRequest(workspacePath, requestId)) {
      return
    }

    activeWorkspaceState.errorMessage =
      error instanceof Error ? error.message : 'Failed to load workspace data'
    activeWorkspaceState.isLoading = false
  }
}

const saveWorkspaceData = async (): Promise<VersionedSaveOutcome> => {
  const state = activeWorkspaceState.dataState!
  const baseVersion = state.baseSnapshot.version

  const savingSnapshot = createSnapshot(
    {
      workspaceId: state.draftSnapshot.workspaceId,
      workspacePath: state.draftSnapshot.workspacePath,
      folders: state.draftSnapshot.folders
    },
    baseVersion
  )

  return workspaceDataStore.saveVersionedData(state, savingSnapshot, async () => {
    const result = await ipcInvoke<UpdateWorkspaceDataResult, UpdateWorkspaceDataRequest>(
      'update-workspace-data',
      {
        workspacePath: state.draftSnapshot.workspacePath,
        folders: state.draftSnapshot.folders.map((folder) => ({
          displayName: folder.displayName
        })),
        version: baseVersion
      }
    )

    return toVersionedSaveResult(
      result,
      (payload) => ({
        data: payload.workspace!,
        version: payload.version!
      }),
      createSnapshot
    )
  })
}

export const createPromptFolder = async (displayName: string): Promise<PromptFolder | null> => {
  const state = activeWorkspaceState.dataState!
  const folderName = sanitizePromptFolderName(displayName)

  state.draftSnapshot.folders = [
    ...state.draftSnapshot.folders,
    {
      folderName,
      displayName
    }
  ]

  workspaceDataStore.markDraftChanged(state)

  const outcome = await saveWorkspaceData()

  if (outcome === 'conflict') {
    return null
  }

  return state.baseSnapshot.data.folders.find((folder) => folder.folderName === folderName) ?? null
}
