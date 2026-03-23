import * as path from 'path'
import type { PromptPersisted, PromptSummaryData } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { PromptFolderConfigFile, WorkspaceInfoFile } from '../DiskTypes/WorkspaceDiskTypes'
import { getFs } from '../fs-provider'
import { readJsonFile } from '../Persistence/FilePersistenceHelpers'
import { parsePromptMarkdown } from '../Persistence/PromptFrontmatter'
import {
  PROMPTS_DIRECTORY_NAME,
  PROMPT_FOLDER_CONFIG_FILENAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  resolvePromptFolderPath,
  resolvePromptPathsFromStem
} from '../Persistence/PromptPersistencePaths'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'

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
    PROMPTS_DIRECTORY_NAME,
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
    if (!entry.isFile() || !entry.name.endsWith(PROMPT_MARKDOWN_FILENAME_SUFFIX)) {
      continue
    }

    const promptStem = entry.name.slice(0, -PROMPT_MARKDOWN_FILENAME_SUFFIX.length)
    const prompt = parsePromptMarkdown(fs.readFileSync(path.join(folderPath, entry.name), 'utf8'))
    if (!prompt) {
      continue
    }
    promptStemByPromptId.set(prompt.id, promptStem)
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

    if (!fs.existsSync(promptPaths.markdownPath)) {
      continue
    }

    const prompt = parsePromptMarkdown(fs.readFileSync(promptPaths.markdownPath, 'utf8'))
    if (!prompt) {
      continue
    }
    prompts.push(prompt)
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
  const promptsPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME)
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
