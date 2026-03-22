import * as path from 'path'
import type { LoadWorkspaceByPathResult } from '@shared/Workspace'
import { isWorkspaceRootPath } from '@shared/workspacePath'
import { getFs } from '../fs-provider'
import { readPromptFolders, readPromptStemByPromptId, readWorkspaceId } from '../DataAccess/WorkspaceReads'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import { data } from '../Data/Data'
import {
  buildPromptFolderSnapshot,
  buildWorkspaceSnapshot
} from '../Data/DataSnapshotHelpers'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
type WorkspaceLoadPayload = Omit<Extract<LoadWorkspaceByPathResult, { success: true }>, 'success'>

const isWorkspacePathValid = (workspacePath: string): boolean => {
  if (isWorkspaceRootPath(workspacePath)) {
    return false
  }

  const fs = getFs()
  return (
    fs.existsSync(path.join(workspacePath, WORKSPACE_INFO_FILENAME)) &&
    fs.existsSync(path.join(workspacePath, PROMPTS_FOLDER_NAME))
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

    loadedPromptIds.push(...promptIds)
    promptFolders.push(promptFolderSnapshot)

    for (const promptId of promptIds) {
      const promptEntry = data.prompt.committedStore.getEntry(promptId)

      if (!promptEntry) {
        continue
      }

      prompts.push({
        id: promptId,
        revision: promptEntry.revision,
        data: {
          id: promptEntry.committed.id,
          title: promptEntry.committed.title,
          promptFolderCount: promptEntry.committed.promptFolderCount
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

const loadWorkspaceDataIntoNewDataLayer = async (workspacePath: string): Promise<string> => {
  const workspaceId = readWorkspaceId(workspacePath)
  const promptFolders = readPromptFolders(workspacePath)

  // Side effect: hydrate workspace into the new committed data store.
  await data.workspace.loadDataFromPersistence(workspaceId, { workspacePath })

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
  workspacePath: string
): Promise<LoadWorkspaceByPathResult> => {
  try {
    if (!isWorkspacePathValid(workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const workspaceId = await loadWorkspaceDataIntoNewDataLayer(workspacePath)
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
