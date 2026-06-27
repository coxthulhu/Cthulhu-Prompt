import * as path from 'path'
import type { PromptPersisted, PromptSummaryData } from '@shared/Prompt'
import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  copyPromptFolderSettings,
  type PromptFolder,
  type PromptFolderSettings
} from '@shared/PromptFolder'
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
  COMPLETED_PROMPTS_FOLDER_NAME,
  PROMPTS_DIRECTORY_NAME,
  PROMPT_FOLDER_INFO_DIRECTORY_NAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  resolvePromptFolderPath,
  resolvePromptFolderInfoPath,
  resolvePromptFolderOrderPath,
  resolveCompletedPromptFolderName,
  resolvePromptFolderSettingsTextPath,
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

const readPromptFolderInfo = (workspacePath: string, folderName: string): PromptFolderInfoFile => {
  const infoPath = resolvePromptFolderInfoPath(workspacePath, folderName)
  return readJsonFile<PromptFolderInfoFile>(infoPath)
}

const readOptionalTextFile = (filePath: string): string => {
  const fs = getFs()

  if (!fs.existsSync(filePath)) {
    return ''
  }

  return fs.readFileSync(filePath, 'utf8')
}

const readPromptIds = (workspacePath: string, folderName: string): string[] => {
  const promptStemByPromptId = readPromptStemByPromptId(workspacePath, folderName)
  return readPromptFolderEntryIds(workspacePath, folderName).filter((entryId) =>
    promptStemByPromptId.has(entryId)
  )
}

export const readPromptFolderEntryIds = (workspacePath: string, folderName: string): string[] => {
  const orderPath = resolvePromptFolderOrderPath(workspacePath, folderName)
  return [...readJsonFile<PromptFolderOrderFile>(orderPath).entryIds]
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
  const promptStemByPromptId = new Map<string, string>()

  if (!fs.existsSync(folderPath)) {
    return promptStemByPromptId
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true })

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
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

export const readPromptFolder = (
  workspacePath: string,
  folderName: string,
  parentPromptFolderId: string | null = null,
  depth = 0
): PromptFolder => {
  const info = readPromptFolderInfo(workspacePath, folderName)
  const folderSettings = Object.fromEntries(
    PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
      field,
      readOptionalTextFile(resolvePromptFolderSettingsTextPath(workspacePath, folderName, field))
    ])
  ) as PromptFolderSettings
  const entryIds = readPromptFolderEntryIds(workspacePath, folderName)
  const promptIds = readPromptIds(workspacePath, folderName)
  const modifiedAt = readPromptFolderModifiedAt(workspacePath, folderName, promptIds)
  const completedPromptIds = Array.from(
    readPromptStemByPromptId(workspacePath, resolveCompletedPromptFolderName(folderName)).keys()
  )

  return {
    id: info.promptFolderId,
    folderName,
    displayName: info.displayName,
    parentPromptFolderId,
    depth,
    modifiedAt,
    promptCount: promptIds.length,
    entryIds,
    completedPromptIds,
    settings: copyPromptFolderSettings(folderSettings)
  }
}

const readPromptFolderModifiedAt = (
  workspacePath: string,
  folderName: string,
  promptIds: string[]
): string | null => {
  const fs = getFs()
  const folderPath = resolvePromptFolderPath(workspacePath, folderName)
  const promptStemByPromptId = readPromptStemByPromptId(workspacePath, folderName)
  let latestModifiedAtMs: number | null = null

  for (const promptId of promptIds) {
    const promptStem = promptStemByPromptId.get(promptId)
    if (!promptStem) {
      continue
    }

    const promptPaths = resolvePromptPathsFromStem(folderPath, promptStem)
    if (!fs.existsSync(promptPaths.markdownPath)) {
      continue
    }

    const modifiedAtMs = fs.statSync(promptPaths.markdownPath).mtime.getTime()
    latestModifiedAtMs =
      latestModifiedAtMs === null ? modifiedAtMs : Math.max(latestModifiedAtMs, modifiedAtMs)
  }

  return latestModifiedAtMs === null ? null : new Date(latestModifiedAtMs).toISOString()
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
    if (!isPromptFolderDirectory(workspacePath, folderName)) {
      continue
    }

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

const isPromptFolderDirectory = (workspacePath: string, folderName: string): boolean => {
  const fs = getFs()
  return fs.existsSync(resolvePromptFolderInfoPath(workspacePath, folderName))
}

const readPromptSubfolders = (
  workspacePath: string,
  parentFolderName: string,
  parentPromptFolderId: string,
  depth: number
): PromptFolder[] => {
  const fs = getFs()
  const parentFolderPath = resolvePromptFolderPath(workspacePath, parentFolderName)
  const promptFolders: PromptFolder[] = []

  if (!fs.existsSync(parentFolderPath)) {
    return promptFolders
  }

  for (const entry of fs.readdirSync(parentFolderPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    if (
      entry.name === PROMPT_FOLDER_INFO_DIRECTORY_NAME ||
      entry.name === COMPLETED_PROMPTS_FOLDER_NAME
    ) {
      continue
    }

    const folderName = path.join(parentFolderName, entry.name)
    if (!isPromptFolderDirectory(workspacePath, folderName)) {
      continue
    }

    const promptFolder = readPromptFolder(workspacePath, folderName, parentPromptFolderId, depth)
    promptFolders.push(promptFolder)
    promptFolders.push(
      ...readPromptSubfolders(workspacePath, folderName, promptFolder.id, depth + 1)
    )
  }

  return promptFolders
}

export const readAllPromptFolders = (workspacePath: string): PromptFolder[] => {
  const promptFolders: PromptFolder[] = []

  for (const promptFolder of readPromptFolders(workspacePath)) {
    promptFolders.push(promptFolder)
    promptFolders.push(
      ...readPromptSubfolders(workspacePath, promptFolder.folderName, promptFolder.id, 1)
    )
  }

  return promptFolders
}
