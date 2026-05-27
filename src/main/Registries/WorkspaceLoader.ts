import * as path from 'path'
import type { LoadWorkspaceByPathResult } from '@shared/Workspace'
import { isWorkspaceRootPath } from '@shared/workspacePath'
import { getFs } from '../fs-provider'
import {
  readPromptFolders,
  readPromptStemByPromptId,
  readWorkspaceInfo
} from '../DataAccess/WorkspaceReads'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import { data } from '../Data/Data'
import {
  buildPromptFolderSnapshot,
  buildWorkspaceSnapshot,
  getLoadedPromptEntries
} from '../Data/DataSnapshotHelpers'
import {
  isWorkspaceInfoPath,
  PROMPTS_DIRECTORY_NAME,
  resolveWorkspacePathFromInfoPath
} from '../Persistence/PromptPersistencePaths'

type WorkspaceLoadPayload = Omit<Extract<LoadWorkspaceByPathResult, { success: true }>, 'success'>

const isWorkspaceInfoPathValid = (workspaceInfoPath: string): boolean => {
  if (!isWorkspaceInfoPath(workspaceInfoPath)) {
    return false
  }

  const workspacePath = resolveWorkspacePathFromInfoPath(workspaceInfoPath)
  if (isWorkspaceRootPath(workspacePath)) {
    return false
  }

  const fs = getFs()
  return (
    fs.existsSync(workspaceInfoPath) &&
    fs.existsSync(path.join(workspacePath, PROMPTS_DIRECTORY_NAME))
  )
}

const buildWorkspaceLoadPayloadFromData = (workspaceId: string): WorkspaceLoadPayload => {
  const workspaceEntry = data.workspace.committedStore.getEntry(workspaceId)

  if (!workspaceEntry) {
    throw new Error('Workspace data must be loaded before building workspace payload')
  }

  const promptFolders: WorkspaceLoadPayload['promptFolders'] = []
  const prompts: WorkspaceLoadPayload['prompts'] = []
  const workspaceSnapshot = buildWorkspaceSnapshot(workspaceEntry)
  const loadedPromptFolderIds = workspaceSnapshot.data.promptFolderIds
  const loadedPromptIds: string[] = []

  for (const promptFolderId of loadedPromptFolderIds) {
    const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderId)

    if (!promptFolderEntry) {
      continue
    }

    const promptFolderSnapshot = buildPromptFolderSnapshot(promptFolderEntry)
    const promptIds = promptFolderSnapshot.data.promptIds
    const loadedPromptEntries = getLoadedPromptEntries(promptIds)

    loadedPromptIds.push(...loadedPromptEntries.map((promptEntry) => promptEntry.committed.id))
    promptFolders.push(promptFolderSnapshot)

    for (const promptEntry of loadedPromptEntries) {
      prompts.push({
        id: promptEntry.committed.id,
        revision: promptEntry.revision,
        data: {
          id: promptEntry.committed.id,
          title: promptEntry.committed.title,
          fallbackTitle: promptEntry.committed.fallbackTitle
        }
      })
    }
  }

  // Side effect: drop stale per-folder UI state and clear invalid screen selections.
  UserPersistenceDataAccess.cleanupWorkspacePromptFolderUiState(workspaceId, loadedPromptFolderIds)
  // Side effect: remove stale prompt editor view-state rows for prompts no longer in the workspace.
  PromptUiStateDataAccess.cleanupWorkspacePromptUiState(workspaceId, loadedPromptIds)

  return {
    workspace: workspaceSnapshot,
    promptFolders,
    prompts
  }
}

const loadWorkspaceDataIntoNewDataLayer = async (workspaceInfoPath: string): Promise<string> => {
  const workspacePath = resolveWorkspacePathFromInfoPath(workspaceInfoPath)
  const workspaceId = readWorkspaceInfo(workspaceInfoPath).workspaceId
  const promptFolders = readPromptFolders(workspacePath)

  // Side effect: hydrate workspace into the new committed data store.
  await data.workspace.loadDataFromPersistence(workspaceId, { workspacePath, workspaceInfoPath })

  // Side effect: hydrate all prompt folders before loading prompt records.
  await Promise.all(
    promptFolders.map((promptFolder) =>
      data.promptFolder.loadDataFromPersistence(promptFolder.id, {
        workspaceId,
        workspacePath,
        folderName: promptFolder.folderName
      })
    )
  )

  const promptLoadTasks = promptFolders.flatMap((promptFolder) => {
    const promptStemByPromptId = readPromptStemByPromptId(workspacePath, promptFolder.folderName)

    return promptFolder.promptIds.map((promptId) =>
      data.prompt.loadDataFromPersistence(promptId, {
        workspaceId,
        workspacePath,
        folderName: promptFolder.folderName,
        promptFolderId: promptFolder.id,
        promptId,
        promptStem: promptStemByPromptId.get(promptId) ?? promptId
      })
    )
  })

  // Side effect: hydrate all prompts only after prompt folder loads complete.
  await Promise.all(promptLoadTasks)

  return workspaceId
}

export const loadWorkspaceByPath = async (
  workspaceInfoPath: string
): Promise<LoadWorkspaceByPathResult> => {
  try {
    if (!isWorkspaceInfoPathValid(workspaceInfoPath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const workspaceId = await loadWorkspaceDataIntoNewDataLayer(workspaceInfoPath)
    const payload = buildWorkspaceLoadPayloadFromData(workspaceId)

    return {
      success: true,
      ...payload
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load workspace by path' }
  }
}
