import * as path from 'path'
import type {
  TanstackLoadWorkspaceByPathResult,
  TanstackLoadWorkspaceByPathSuccess
} from '@shared/tanstack/TanstackWorkspaceLoad'
import { isTanstackWorkspaceRootPath } from '@shared/tanstack/TanstackWorkspacePath'
import { getTanstackFs } from './TanstackFsProvider'
import { tanstackRevisions } from './TanstackRevisions'
import { registerTanstackWorkspace } from './TanstackWorkspaceRegistry'
import { readTanstackPromptFolders, readTanstackWorkspaceId } from './TanstackWorkspaceReads'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'

const isTanstackWorkspacePathValid = (workspacePath: string): boolean => {
  if (isTanstackWorkspaceRootPath(workspacePath)) {
    return false
  }

  const fs = getTanstackFs()
  return (
    fs.existsSync(path.join(workspacePath, WORKSPACE_INFO_FILENAME)) &&
    fs.existsSync(path.join(workspacePath, PROMPTS_FOLDER_NAME))
  )
}

const buildTanstackWorkspaceLoadSuccess = (
  workspacePath: string
): TanstackLoadWorkspaceByPathSuccess => {
  const workspaceId = readTanstackWorkspaceId(workspacePath)
  const promptFolders = readTanstackPromptFolders(workspacePath)

  // Side effect: keep path/id translation in memory for later TanStack loads.
  registerTanstackWorkspace(workspaceId, workspacePath)

  return {
    workspace: {
      id: workspaceId,
      revision: tanstackRevisions.workspace.get(workspaceId),
      data: {
        id: workspaceId,
        workspacePath,
        promptFolderIds: promptFolders.map((promptFolder) => promptFolder.id)
      }
    },
    promptFolders: promptFolders.map((promptFolder) => ({
      id: promptFolder.id,
      revision: tanstackRevisions.promptFolder.get(promptFolder.id),
      data: promptFolder
    }))
  }
}

export const loadTanstackWorkspaceByPath = async (
  workspacePath: string
): Promise<TanstackLoadWorkspaceByPathResult> => {
  try {
    if (!isTanstackWorkspacePathValid(workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    return {
      success: true,
      ...buildTanstackWorkspaceLoadSuccess(workspacePath)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load workspace by path' }
  }
}
