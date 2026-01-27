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

let activeWorkspaceState = $state<WorkspaceState | null>(null)

const workspaceStatesById = new SvelteMap<string, WorkspaceState>()
const workspaceIdByPath = new SvelteMap<string, string>()
let nextRequestId = 0
let latestRequestId = 0

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

// Workspace drafts mirror persisted data, so cloning the snapshot is enough.
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

const replaceWorkspaceState = (
  workspaceId: string,
  snapshot: VersionedSnapshot<WorkspaceData>
): WorkspaceState => {
  const nextState = $state<WorkspaceState>(workspaceDataStore.createState(snapshot))
  workspaceStatesById.set(workspaceId, nextState)
  workspaceIdByPath.set(snapshot.data.workspacePath, workspaceId)
  return nextState
}

const createLoadingState = (workspacePath: string, requestId: number): WorkspaceState => {
  const snapshot = createSnapshot(
    {
      workspaceId: `loading-${requestId}`,
      workspacePath,
      folders: []
    },
    0
  )

  const state = $state<WorkspaceState>(workspaceDataStore.createState(snapshot))
  state.isLoading = true
  state.requestId = requestId
  return state
}

export const getActiveWorkspaceState = (): WorkspaceState | null => activeWorkspaceState

export const setActiveWorkspacePath = async (workspacePath: string | null): Promise<void> => {
  const requestId = (nextRequestId += 1)
  latestRequestId = requestId

  if (!workspacePath) {
    activeWorkspaceState = null
    return
  }

  const cachedWorkspaceId = workspaceIdByPath.get(workspacePath) ?? null
  const cachedState = cachedWorkspaceId ? workspaceStatesById.get(cachedWorkspaceId) ?? null : null

  if (cachedState) {
    cachedState.requestId = requestId
    cachedState.isLoading = true
    cachedState.loadErrorMessage = null
    activeWorkspaceState = cachedState
  } else {
    activeWorkspaceState = createLoadingState(workspacePath, requestId)
  }

  try {
    const result = await ipcInvoke<LoadWorkspaceDataResult, LoadWorkspaceDataRequest>(
      'load-workspace-data',
      {
        workspacePath
      }
    )

    if (latestRequestId !== requestId) {
      return
    }

    if (!result.success) {
      activeWorkspaceState!.loadErrorMessage = result.error
      activeWorkspaceState!.isLoading = false
      return
    }

    const snapshot = createSnapshot(result.workspace, result.version)
    const nextState = replaceWorkspaceState(result.workspace.workspaceId, snapshot)
    nextState.requestId = requestId
    nextState.isLoading = false
    nextState.loadErrorMessage = null

    activeWorkspaceState = nextState
  } catch (error) {
    if (latestRequestId !== requestId) {
      return
    }

    activeWorkspaceState!.loadErrorMessage =
      error instanceof Error ? error.message : 'Failed to load workspace data'
    activeWorkspaceState!.isLoading = false
  }
}

const saveWorkspaceData = async (): Promise<VersionedSaveOutcome> => {
  const state = activeWorkspaceState!
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
  const state = activeWorkspaceState!
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
