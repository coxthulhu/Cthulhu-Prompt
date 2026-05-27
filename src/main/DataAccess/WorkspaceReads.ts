import * as path from 'path'
import type { PromptPersisted, PromptSummaryData } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type {
  PromptFolderInfoFile,
  PromptFolderOrderFile,
  WorkspacePromptFolderOrderFile,
  WorkspaceInfoFile
} from '../DiskTypes/WorkspaceDiskTypes'
import { getFs } from '../fs-provider'
import { readJsonFile } from '../Persistence/FilePersistenceHelpers'
import { parsePromptMarkdown } from '../Persistence/PromptFrontmatter'
import {
  PROMPTS_DIRECTORY_NAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  resolvePromptFolderPath,
  resolvePromptFolderDescriptionPath,
  resolvePromptFolderInfoPath,
  resolvePromptFolderOrderPath,
  resolvePromptPathsFromStem,
  resolveWorkspacePromptFolderOrderPath
} from '../Persistence/PromptPersistencePaths'

export const readWorkspaceInfo = (workspaceInfoPath: string): WorkspaceInfoFile => {
  const parsed = readJsonFile<WorkspaceInfoFile>(workspaceInfoPath)

  if (!parsed.workspaceId || !parsed.workspaceName) {
    throw new Error('Invalid workspace info')
  }

  return parsed
}

const readPromptFolderInfo = (
  workspacePath: string,
  folderName: string
): PromptFolderInfoFile => {
  const infoPath = resolvePromptFolderInfoPath(workspacePath, folderName)
  return readJsonFile<PromptFolderInfoFile>(infoPath)
}

const readPromptFolderDescription = (workspacePath: string, folderName: string): string => {
  const fs = getFs()
  const descriptionPath = resolvePromptFolderDescriptionPath(workspacePath, folderName)

  if (!fs.existsSync(descriptionPath)) {
    return ''
  }

  return fs.readFileSync(descriptionPath, 'utf8')
}

const readPromptIds = (workspacePath: string, folderName: string): string[] => {
  const orderPath = resolvePromptFolderOrderPath(workspacePath, folderName)
  return [...readJsonFile<PromptFolderOrderFile>(orderPath).promptIds]
}

const readWorkspacePromptFolderIds = (workspacePath: string): string[] => {
  const orderPath = resolveWorkspacePromptFolderOrderPath(workspacePath)
  return [...readJsonFile<WorkspacePromptFolderOrderFile>(orderPath).promptFolderIds]
}

const readFileModifiedAt = (filePath: string): string => {
  const fs = getFs()
  return fs.statSync(filePath).mtime.toISOString()
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
  const info = readPromptFolderInfo(workspacePath, folderName)
  const folderDescription = readPromptFolderDescription(workspacePath, folderName)
  const promptIds = readPromptIds(workspacePath, folderName)

  return {
    id: info.promptFolderId,
    folderName,
    displayName: info.displayName,
    promptCount: promptIds.length,
    promptIds,
    folderDescription
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

    const prompt = parsePromptMarkdown(
      fs.readFileSync(promptPaths.markdownPath, 'utf8'),
      readFileModifiedAt(promptPaths.markdownPath)
    )
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
    fallbackTitle: prompt.fallbackTitle
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

  const promptFolderById = new Map(
    promptFolders.map((promptFolder) => [promptFolder.id, promptFolder])
  )
  const orderedPromptFolders: PromptFolder[] = []
  const orderedPromptFolderIds = new Set<string>()

  for (const promptFolderId of readWorkspacePromptFolderIds(workspacePath)) {
    const promptFolder = promptFolderById.get(promptFolderId)
    if (!promptFolder || orderedPromptFolderIds.has(promptFolderId)) {
      continue
    }

    orderedPromptFolders.push(promptFolder)
    orderedPromptFolderIds.add(promptFolderId)
  }

  const unorderedPromptFolders = promptFolders
    .filter((promptFolder) => !orderedPromptFolderIds.has(promptFolder.id))
    .sort((left, right) =>
      left.folderName.toLowerCase().localeCompare(right.folderName.toLowerCase())
    )

  return [...orderedPromptFolders, ...unorderedPromptFolders]
}
