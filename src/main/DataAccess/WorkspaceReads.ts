import * as path from 'path'
import type { Prompt } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type {
  PromptFolderConfigFile,
  PromptsFile,
  WorkspaceInfoFile
} from '../DiskTypes/WorkspaceDiskTypes'
import { getFs } from '../fs-provider'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPTS_FILENAME = 'Prompts.json'

export const readWorkspaceId = (workspacePath: string): string => {
  const fs = getFs()
  const workspaceInfoPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
  const parsed = JSON.parse(fs.readFileSync(workspaceInfoPath, 'utf8')) as WorkspaceInfoFile

  if (!parsed.workspaceId) {
    throw new Error('Invalid workspace info')
  }

  return parsed.workspaceId
}

const readPromptFolderConfig = (
  workspacePath: string,
  folderName: string
): PromptFolderConfigFile => {
  const fs = getFs()
  const configPath = path.join(
    workspacePath,
    PROMPTS_FOLDER_NAME,
    folderName,
    PROMPT_FOLDER_CONFIG_FILENAME
  )
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfigFile
}

const readPromptIds = (workspacePath: string, folderName: string): string[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as PromptsFile
  return parsed.prompts.map((prompt) => prompt.id)
}

export const readPromptFolder = (
  workspacePath: string,
  folderName: string
): PromptFolder => {
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

export const readPrompts = (workspacePath: string, folderName: string): Prompt[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as { prompts?: Prompt[] }
  return parsed.prompts ?? []
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
