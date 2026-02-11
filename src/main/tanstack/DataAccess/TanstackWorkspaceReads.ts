import * as path from 'path'
import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'
import type { TanstackPromptFolder } from '@shared/tanstack/TanstackPromptFolder'
import type {
  TanstackPromptFolderConfigFile,
  TanstackPromptsFile,
  TanstackWorkspaceInfoFile
} from '@shared/tanstack/DiskTypes/TanstackWorkspaceDiskTypes'
import { getTanstackFs } from './TanstackFsProvider'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPTS_FILENAME = 'Prompts.json'

export const readTanstackWorkspaceId = (workspacePath: string): string => {
  const fs = getTanstackFs()
  const workspaceInfoPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
  const parsed = JSON.parse(fs.readFileSync(workspaceInfoPath, 'utf8')) as TanstackWorkspaceInfoFile

  if (!parsed.workspaceId) {
    throw new Error('Invalid workspace info')
  }

  return parsed.workspaceId
}

const readTanstackPromptFolderConfig = (
  workspacePath: string,
  folderName: string
): TanstackPromptFolderConfigFile => {
  const fs = getTanstackFs()
  const configPath = path.join(
    workspacePath,
    PROMPTS_FOLDER_NAME,
    folderName,
    PROMPT_FOLDER_CONFIG_FILENAME
  )
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as TanstackPromptFolderConfigFile
}

const readTanstackPromptIds = (workspacePath: string, folderName: string): string[] => {
  const fs = getTanstackFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as TanstackPromptsFile
  return parsed.prompts.map((prompt) => prompt.id)
}

export const readTanstackPromptFolder = (
  workspacePath: string,
  folderName: string
): TanstackPromptFolder => {
  const config = readTanstackPromptFolderConfig(workspacePath, folderName)
  const promptIds = readTanstackPromptIds(workspacePath, folderName)

  return {
    id: config.promptFolderId,
    folderName,
    displayName: config.foldername,
    promptCount: config.promptCount,
    promptIds,
    folderDescription: config.folderDescription
  }
}

export const readTanstackPrompts = (workspacePath: string, folderName: string): TanstackPrompt[] => {
  const fs = getTanstackFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as { prompts?: TanstackPrompt[] }
  return parsed.prompts ?? []
}

export const readTanstackPromptFolders = (workspacePath: string): TanstackPromptFolder[] => {
  const fs = getTanstackFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME)
  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })
  const promptFolders: TanstackPromptFolder[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const folderName = entry.name
    promptFolders.push(readTanstackPromptFolder(workspacePath, folderName))
  }

  return promptFolders
}
