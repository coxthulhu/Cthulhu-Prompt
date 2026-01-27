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

const workspaceDataStore = createVersionedDataStore<
  WorkspaceDraft,
  WorkspaceData,
  LoadWorkspaceDataResult
>({
  createDraft,
  isDraftDirty,
  createSnapshotFromLoad: (result) => createSnapshot(result.workspace, result.version),
  applyLoadedSnapshot: (snapshot) =>
    replaceWorkspaceState(snapshot.data.workspaceId, snapshot)
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

const createLoadingState = (workspacePath: string): WorkspaceState => {
  const snapshot = createSnapshot(
    {
      workspaceId: 'loading',
      workspacePath,
      folders: []
    },
    0
  )

  const state = $state<WorkspaceState>(workspaceDataStore.createState(snapshot))
  return state
}

export const getActiveWorkspaceState = (): WorkspaceState | null => activeWorkspaceState

export const setActiveWorkspacePath = async (workspacePath: string | null): Promise<void> => {
  if (!workspacePath) {
    activeWorkspaceState = null
    return
  }

  const cachedWorkspaceId = workspaceIdByPath.get(workspacePath) ?? null
  const cachedState = cachedWorkspaceId ? workspaceStatesById.get(cachedWorkspaceId) ?? null : null

  const state = cachedState ?? createLoadingState(workspacePath)
  activeWorkspaceState = state

  const loadOutcome = await workspaceDataStore.loadVersionedData(state, async () => {
    return await ipcInvoke<LoadWorkspaceDataResult, LoadWorkspaceDataRequest>(
      'load-workspace-data',
      {
        workspacePath
      }
    )
  })

  // Only swap the active state if this request still targets it.
  if (loadOutcome.type === 'loaded' && activeWorkspaceState === state) {
    activeWorkspaceState = loadOutcome.state
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
