import * as path from 'path'
import type { LoadWorkspaceByPathResult } from '@shared/Workspace'
import { isWorkspaceRootPath } from '@shared/workspacePath'
import { getFs } from '../fs-provider'
import { revisions } from './Revisions'
import { registerPrompts, registerPromptFolders, registerWorkspace } from './WorkspaceRegistry'
import {
  readPromptFolders,
  readPromptSummaries,
  readWorkspaceId
} from '../DataAccess/WorkspaceReads'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import { data } from '../Data/Data'
import { readJsonFile } from '../Persistence/FilePersistenceHelpers'
import { resolvePromptFolderPath } from '../Persistence/PromptPersistencePaths'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_METADATA_SUFFIX = '.prompt.json'
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
  const workspaceId = readWorkspaceId(workspacePath)
  const promptFolders = readPromptFolders(workspacePath)
  const prompts = promptFolders.flatMap((promptFolder) =>
    readPromptSummaries(workspacePath, promptFolder.folderName)
  )
  const workspacePromptIds = promptFolders.flatMap((promptFolder) => promptFolder.promptIds)
  // Side effect: drop stale per-folder UI state and clear invalid screen selections.
  UserPersistenceDataAccess.cleanupWorkspacePromptFolderUiState(
    workspaceId,
    promptFolders.map((promptFolder) => promptFolder.id)
  )
  // Side effect: remove stale prompt editor view-state rows for prompts no longer in the workspace.
  PromptUiStateDataAccess.cleanupWorkspacePromptUiState(workspaceId, workspacePromptIds)

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
    })),
    prompts: prompts.map((prompt) => ({
      id: prompt.id,
      revision: revisions.prompt.get(prompt.id),
      data: prompt
    }))
  }
}

const loadPromptStemByPromptId = (workspacePath: string, folderName: string): Map<string, string> => {
  const fs = getFs()
  const folderPath = resolvePromptFolderPath(workspacePath, folderName)
  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  const promptStemByPromptId = new Map<string, string>()

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(PROMPT_METADATA_SUFFIX)) {
      continue
    }

    const promptStem = entry.name.slice(0, -PROMPT_METADATA_SUFFIX.length)
    const metadataPath = path.join(folderPath, entry.name)
    const metadata = readJsonFile<{ id: string }>(metadataPath)
    promptStemByPromptId.set(metadata.id, promptStem)
  }

  return promptStemByPromptId
}

const loadWorkspaceDataIntoNewDataLayer = async (workspacePath: string): Promise<void> => {
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
    const promptStemByPromptId = loadPromptStemByPromptId(workspacePath, promptFolder.folderName)

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
}

export const loadWorkspaceByPath = async (
  workspacePath: string
): Promise<LoadWorkspaceByPathResult> => {
  try {
    if (!isWorkspacePathValid(workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const [payload] = await Promise.all([
      Promise.resolve().then(() => buildWorkspaceLoadSuccess(workspacePath)),
      loadWorkspaceDataIntoNewDataLayer(workspacePath)
    ])

    return {
      success: true,
      ...payload
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message || 'Failed to load workspace by path' }
  }
}
