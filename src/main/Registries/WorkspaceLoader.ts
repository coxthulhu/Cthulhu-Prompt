import * as path from 'path'
import type { LoadWorkspaceByPathResult } from '@shared/Workspace'
import { isWorkspaceRootPath } from '@shared/workspacePath'
import { getFs } from '../fs-provider'
import { revisions } from './Revisions'
import { registerPrompts, registerPromptFolders, registerWorkspace } from './WorkspaceRegistry'
import { readPromptFolders } from '../DataAccess/WorkspaceReads'
import { markWorkspaceOpened } from '../Services/WorkspacePersistenceLifecycle'

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

const buildWorkspaceLoadSuccess = (workspacePath: string): WorkspaceLoadPayload => {
  // Side effect: opening a workspace ensures workspace persistence metadata exists.
  const workspaceId = markWorkspaceOpened(workspacePath)
  const promptFolders = readPromptFolders(workspacePath)

  // Side effect: keep path/id translation in memory for later  loads.
  registerWorkspace(workspaceId, workspacePath)
  registerPromptFolders(
    workspaceId,
    workspacePath,
    promptFolders.map((promptFolder) => ({
      id: promptFolder.id,
      folderName: promptFolder.folderName
    }))
  )
  for (const promptFolder of promptFolders) {
    registerPrompts(
      workspaceId,
      workspacePath,
      promptFolder.id,
      promptFolder.folderName,
      promptFolder.promptIds
    )
  }

  return {
    workspace: {
      id: workspaceId,
      revision: revisions.workspace.get(workspaceId),
      data: {
        id: workspaceId,
        workspacePath,
        promptFolderIds: promptFolders.map((promptFolder) => promptFolder.id)
      }
    },
    promptFolders: promptFolders.map((promptFolder) => ({
      id: promptFolder.id,
      revision: revisions.promptFolder.get(promptFolder.id),
      data: promptFolder
    }))
  }
}

export const loadWorkspaceByPath = async (
  workspacePath: string
): Promise<LoadWorkspaceByPathResult> => {
  try {
    if (!isWorkspacePathValid(workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const payload = buildWorkspaceLoadSuccess(workspacePath)

    return {
      success: true,
      ...payload
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load workspace by path' }
  }
}
