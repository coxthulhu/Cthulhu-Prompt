import * as path from 'path'
import type { TanstackLoadWorkspaceByPathResult } from '@shared/tanstack/TanstackWorkspaceLoad'
import { isWorkspaceRootPath } from '@shared/workspacePath'
import { getFs } from '../../fs-provider'
import { tanstackRevisions } from './TanstackRevisions'
import {
  registerTanstackPrompts,
  registerTanstackPromptFolders,
  registerTanstackWorkspace
} from './TanstackWorkspaceRegistry'
import { readTanstackPromptFolders, readTanstackWorkspaceId } from '../DataAccess/TanstackWorkspaceReads'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
type TanstackWorkspaceLoadPayload = Omit<
  Extract<TanstackLoadWorkspaceByPathResult, { success: true }>,
  'success'
>

const isTanstackWorkspacePathValid = (workspacePath: string): boolean => {
  if (isWorkspaceRootPath(workspacePath)) {
    return false
  }

  const fs = getFs()
  return (
    fs.existsSync(path.join(workspacePath, WORKSPACE_INFO_FILENAME)) &&
    fs.existsSync(path.join(workspacePath, PROMPTS_FOLDER_NAME))
  )
}

const buildTanstackWorkspaceLoadSuccess = (
  workspacePath: string
): TanstackWorkspaceLoadPayload => {
  const workspaceId = readTanstackWorkspaceId(workspacePath)
  const promptFolders = readTanstackPromptFolders(workspacePath)

  // Side effect: keep path/id translation in memory for later TanStack loads.
  registerTanstackWorkspace(workspaceId, workspacePath)
  registerTanstackPromptFolders(
    workspaceId,
    workspacePath,
    promptFolders.map((promptFolder) => ({
      id: promptFolder.id,
      folderName: promptFolder.folderName
    }))
  )
  for (const promptFolder of promptFolders) {
    registerTanstackPrompts(
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

    const payload = buildTanstackWorkspaceLoadSuccess(workspacePath)

    return {
      success: true,
      ...payload
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load workspace by path' }
  }
}
