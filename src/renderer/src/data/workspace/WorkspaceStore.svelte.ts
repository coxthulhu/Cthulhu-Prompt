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
import { preparePromptFolderName } from '@shared/promptFolderName'
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

const cloneWorkspaceData = (data: WorkspaceData): WorkspaceData => ({
  workspaceId: data.workspaceId,
  workspacePath: data.workspacePath,
  folders: data.folders.map((folder) => ({ ...folder }))
})

const createSnapshot = (
  data: WorkspaceData,
  version: number
): VersionedSnapshot<WorkspaceData> => ({
  data: cloneWorkspaceData(data),
  version
})

const createDraft = (snapshot: VersionedSnapshot<WorkspaceData>): WorkspaceDraft =>
  cloneWorkspaceData(snapshot.data)

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

const finishWorkspaceLoad = (
  workspacePath: string,
  requestId: number,
  apply: () => void
): void => {
  if (!isLatestRequest(workspacePath, requestId)) {
    return
  }

  apply()
  activeWorkspaceState.isLoading = false
}

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

    finishWorkspaceLoad(workspacePath, requestId, () => {
      if (!result.success) {
        activeWorkspaceState.errorMessage = result.error
        return
      }

      const snapshot = createSnapshot(result.workspace, result.version)
      replaceWorkspaceState(result.workspace.workspaceId, snapshot)
    })
  } catch (error) {
    finishWorkspaceLoad(workspacePath, requestId, () => {
      activeWorkspaceState.errorMessage =
        error instanceof Error ? error.message : 'Failed to load workspace data'
    })
  }
}

const saveWorkspaceData = async (): Promise<VersionedSaveOutcome> => {
  const state = activeWorkspaceState.dataState!
  const baseVersion = state.baseSnapshot.version

  const savingSnapshot = createSnapshot(state.draftSnapshot, baseVersion)

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

    return toVersionedSaveResult(result, createSnapshot)
  })
}

export const createPromptFolder = async (displayName: string): Promise<PromptFolder | null> => {
  const state = activeWorkspaceState.dataState!
  const { displayName: normalizedDisplayName, folderName } =
    preparePromptFolderName(displayName)

  state.draftSnapshot.folders = [
    ...state.draftSnapshot.folders,
    {
      folderName,
      displayName: normalizedDisplayName
    }
  ]

  workspaceDataStore.markDraftChanged(state)

  const outcome = await saveWorkspaceData()

  if (outcome === 'conflict') {
    return null
  }

  return state.baseSnapshot.data.folders.find((folder) => folder.folderName === folderName) ?? null
}
