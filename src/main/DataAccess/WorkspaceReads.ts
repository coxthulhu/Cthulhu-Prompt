import * as path from 'path'
import type { PromptPersisted, PromptSummaryData } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type {
  PromptFolderConfigFile,
  PromptMetadataFile,
  WorkspaceInfoFile
} from '../DiskTypes/WorkspaceDiskTypes'
import { getFs } from '../fs-provider'
import { readJsonFile } from '../Persistence/FilePersistenceHelpers'
import { resolvePromptFolderPath, resolvePromptPathsFromStem } from '../Persistence/PromptPersistencePaths'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPT_METADATA_SUFFIX = '.prompt.json'

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
  const config = readPromptFolderConfig(workspacePath, folderName)
  return [...config.promptIds]
}

export const readPromptStemByPromptId = (
  workspacePath: string,
  folderName: string
): Map<string, string> => {
  const fs = getFs()
  const folderPath = resolvePromptFolderPath(workspacePath, folderName)
  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  const promptStemByPromptId = new Map<string, string>()

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(PROMPT_METADATA_SUFFIX)) {
      continue
    }

    const promptStem = entry.name.slice(0, -PROMPT_METADATA_SUFFIX.length)
    const metadata = readJsonFile<PromptMetadataFile>(path.join(folderPath, entry.name))
    promptStemByPromptId.set(metadata.id, promptStem)
  }

  return promptStemByPromptId
}

export const readPromptFolder = (workspacePath: string, folderName: string): PromptFolder => {
  const config = readPromptFolderConfig(workspacePath, folderName)

  return {
    id: config.promptFolderId,
    folderName,
    displayName: config.foldername,
    promptCount: config.promptCount,
    promptIds: [...config.promptIds],
    folderDescription: config.folderDescription
  }
}

export const readPrompts = (workspacePath: string, folderName: string): PromptPersisted[] => {
  const fs = getFs()
  const promptIds = readPromptIds(workspacePath, folderName)
  const promptStemByPromptId = readPromptStemByPromptId(workspacePath, folderName)
  const folderPath = resolvePromptFolderPath(workspacePath, folderName)
  const prompts: PromptPersisted[] = []

  for (const promptId of promptIds) {
    const promptStem = promptStemByPromptId.get(promptId)

    if (!promptStem) {
      continue
    }

    const promptPaths = resolvePromptPathsFromStem(folderPath, promptStem)

    if (!fs.existsSync(promptPaths.metadataPath) || !fs.existsSync(promptPaths.markdownPath)) {
      continue
    }

    const metadata = readJsonFile<PromptMetadataFile>(promptPaths.metadataPath)
    const promptText = fs.readFileSync(promptPaths.markdownPath, 'utf8')

    prompts.push({
      id: metadata.id,
      title: metadata.title,
      creationDate: metadata.creationDate,
      lastModifiedDate: metadata.lastModifiedDate,
      promptFolderCount: metadata.promptFolderCount,
      promptText
    })
  }

  return prompts
}

export const readPromptSummaries = (
  workspacePath: string,
  folderName: string
): PromptSummaryData[] => {
  const prompts = readPrompts(workspacePath, folderName)
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
