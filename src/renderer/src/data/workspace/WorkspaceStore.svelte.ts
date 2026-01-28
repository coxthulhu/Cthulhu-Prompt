import { SvelteMap } from 'svelte/reactivity'

import type {
  LoadWorkspaceDataRequest,
  LoadWorkspaceDataResult,
  LoadWorkspaceDataSuccess,
  PromptFolder,
  UpdateWorkspaceDataRequest,
  WorkspaceData
} from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import { preparePromptFolderName } from '@shared/promptFolderName'
import {
  createRevisionDataStore,
  type RevisionDataState,
  type RevisionMutationResult,
  type RevisionSaveOutcome,
  type RevisionSnapshot
} from '@renderer/data/revisioned/RevisionDataStore'
import { createRevisionMutation } from '@renderer/data/revisioned/GlobalMutationsQueue'
import { createRevisionLoad } from '@renderer/data/revisioned/GlobalLoadsQueue'

export type WorkspaceDraft = WorkspaceData
export type WorkspaceState = RevisionDataState<WorkspaceDraft, WorkspaceData>

let activeWorkspaceState = $state<WorkspaceState | null>(null)

const workspaceStatesById = new SvelteMap<string, WorkspaceState>()
const workspaceIdByPath = new SvelteMap<string, string>()
const LOADING_WORKSPACE_ID = 'loading'

const cloneWorkspaceData = (data: WorkspaceData): WorkspaceData => ({
  workspaceId: data.workspaceId,
  workspacePath: data.workspacePath,
  folders: data.folders.map((folder) => ({ ...folder }))
})

const createSnapshot = (
  data: WorkspaceData,
  revision: number
): RevisionSnapshot<WorkspaceData> => ({
  data: cloneWorkspaceData(data),
  revision
})

// Workspace drafts mirror persisted data, so cloning the snapshot is enough.
const createDraft = (snapshot: RevisionSnapshot<WorkspaceData>): WorkspaceDraft =>
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
  snapshot: RevisionSnapshot<WorkspaceData>
): boolean => {
  if (draft.workspaceId !== snapshot.data.workspaceId) {
    return true
  }

  if (draft.workspacePath !== snapshot.data.workspacePath) {
    return true
  }

  return !areFoldersEqual(draft.folders, snapshot.data.folders)
}

const workspaceDataStore = createRevisionDataStore<
  WorkspaceDraft,
  WorkspaceData,
  LoadWorkspaceDataSuccess
>({
  createDraft,
  isDraftDirty,
  createSnapshotFromLoad: (result) => createSnapshot(result.workspace, result.revision),
  applyLoadedSnapshot: (snapshot) =>
    replaceWorkspaceState(snapshot.data.workspaceId, snapshot)
})

const createWorkspaceState = (snapshot: RevisionSnapshot<WorkspaceData>): WorkspaceState => {
  const state = $state<WorkspaceState>(workspaceDataStore.createState(snapshot))
  return state
}

const replaceWorkspaceState = (
  workspaceId: string,
  snapshot: RevisionSnapshot<WorkspaceData>
): WorkspaceState => {
  const nextState = createWorkspaceState(snapshot)
  workspaceStatesById.set(workspaceId, nextState)
  workspaceIdByPath.set(snapshot.data.workspacePath, workspaceId)
  return nextState
}

const createLoadingState = (workspacePath: string): WorkspaceState => {
  const snapshot = createSnapshot(
    {
      workspaceId: LOADING_WORKSPACE_ID,
      workspacePath,
      folders: []
    },
    0
  )

  return createWorkspaceState(snapshot)
}

export const getActiveWorkspacePath = (): string | null =>
  activeWorkspaceState?.baseSnapshot.data.workspacePath ?? null

export const getActiveWorkspaceFolders = (): PromptFolder[] =>
  activeWorkspaceState?.draftSnapshot.folders ?? []

export const getActiveWorkspaceLoadingState = (): boolean =>
  activeWorkspaceState?.isLoading ?? false

const requireActiveWorkspaceState = (): WorkspaceState => activeWorkspaceState!

export const setActiveWorkspacePath = async (workspacePath: string | null): Promise<void> => {
  if (!workspacePath) {
    activeWorkspaceState = null
    return
  }

  const cachedWorkspaceId = workspaceIdByPath.get(workspacePath) ?? null
  const cachedState = cachedWorkspaceId ? workspaceStatesById.get(cachedWorkspaceId) ?? null : null

  const state = cachedState ?? createLoadingState(workspacePath)
  activeWorkspaceState = state

  const loadOutcome = await createRevisionLoad({
    store: workspaceDataStore,
    state,
    run: () => {
      return ipcInvoke<LoadWorkspaceDataResult, LoadWorkspaceDataRequest>(
        'load-workspace-data',
        {
          workspacePath
        }
      )
    }
  })

  // Only swap the active state if this request still targets it.
  if (loadOutcome.type === 'loaded' && activeWorkspaceState === state) {
    activeWorkspaceState = loadOutcome.state
  }
}

const saveWorkspaceData = (): Promise<RevisionSaveOutcome> => {
  const state = requireActiveWorkspaceState()
  const workspacePath = state.draftSnapshot.workspacePath
  const foldersToSave = state.draftSnapshot.folders.map((folder) => ({
    displayName: folder.displayName
  }))

  return createRevisionMutation({
    elements: [{ store: workspaceDataStore, state }],
    run: ([revision]) => {
      return ipcInvoke<RevisionMutationResult<WorkspaceData>, UpdateWorkspaceDataRequest>(
        'update-workspace-data',
        {
          workspacePath,
          folders: foldersToSave,
          revision
        }
      )
    },
    onSuccess: (result) => {
      return workspaceDataStore.applySaveSuccess(
        state,
        createSnapshot(result.data, result.revision)
      )
    },
    onConflict: (result) => {
      return workspaceDataStore.applySaveConflict(
        state,
        createSnapshot(result.data, result.revision)
      )
    }
  })
}

export const createPromptFolder = async (displayName: string): Promise<PromptFolder | null> => {
  const state = requireActiveWorkspaceState()
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
