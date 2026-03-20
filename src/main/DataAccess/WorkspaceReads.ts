import * as path from 'path'
import type { PromptPersisted, PromptSummaryData } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type {
  PromptFolderConfigFile,
  PromptsFile,
  WorkspaceInfoFile
} from '../DiskTypes/WorkspaceDiskTypes'
import { getFs } from '../fs-provider'
import { readJsonFile } from '../Persistence/FilePersistenceHelpers'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPTS_FILENAME = 'Prompts.json'

export const readWorkspaceId = (workspacePath: string): string => {
  const workspaceInfoPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
  const parsed = readJsonFile<WorkspaceInfoFile>(workspaceInfoPath)

  if (!parsed.workspaceId) {
    throw new Error('Invalid workspace info')
  }

  return parsed.workspaceId
}

const readPromptFolderConfig = (
  workspacePath: string,
  folderName: string
): PromptFolderConfigFile => {
  const configPath = path.join(
    workspacePath,
    PROMPTS_FOLDER_NAME,
    folderName,
    PROMPT_FOLDER_CONFIG_FILENAME
  )
  return readJsonFile<PromptFolderConfigFile>(configPath)
}

const readPromptIds = (workspacePath: string, folderName: string): string[] => {
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  const parsed = readJsonFile<PromptsFile>(promptsPath)
  return parsed.prompts.map((prompt) => prompt.id)
}

export const readPromptFolder = (workspacePath: string, folderName: string): PromptFolder => {
  const config = readPromptFolderConfig(workspacePath, folderName)
  const promptIds = readPromptIds(workspacePath, folderName)

  return {
    id: config.promptFolderId,
    folderName,
    displayName: config.foldername,
    promptCount: config.promptCount,
    promptIds,
    folderDescription: config.folderDescription
  }
}

export const readPrompts = (workspacePath: string, folderName: string): PromptPersisted[] => {
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  const parsed = readJsonFile<{
    prompts?: PromptPersisted[]
  }>(promptsPath)
  return parsed.prompts ?? []
}

export const readPromptSummaries = (
  workspacePath: string,
  folderName: string
): PromptSummaryData[] => {
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  const parsed = readJsonFile<{
    prompts?: PromptPersisted[]
  }>(promptsPath)
  const prompts = parsed.prompts ?? []
  return prompts.map((prompt) => ({
    id: prompt.id,
    title: prompt.title,
    promptFolderCount: prompt.promptFolderCount
  }))
}

export const readPromptFolders = (workspacePath: string): PromptFolder[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME)
  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })
  const promptFolders: PromptFolder[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const folderName = entry.name
    promptFolders.push(readPromptFolder(workspacePath, folderName))
  }

  return promptFolders
}
