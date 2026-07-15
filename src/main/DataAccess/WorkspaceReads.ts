import * as path from 'path'
import type { PromptPersisted, PromptSummaryData } from '@shared/Prompt'
import {
  folderEntryRef,
  promptEntryRef,
  type EntryRef,
  type FolderEntryRef
} from '@shared/OrderContainer'
import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  copyPromptFolderSettings,
  type PromptFolder,
  type PromptFolderSettings
} from '@shared/PromptFolder'
import type { PromptFolderInfoFile, WorkspaceInfoFile } from '../DiskTypes/WorkspaceDiskTypes'
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
  return readPromptFolderEntries(workspacePath, folderName)
    .filter((entry) => entry.kind === 'prompt' && promptStemByPromptId.has(entry.id))
    .map((entry) => entry.id)
}

const isEntryRef = (value: unknown): value is EntryRef => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (entry.kind === 'prompt' || entry.kind === 'folder') && typeof entry.id === 'string'
}

const readOrderEntries = <TEntry extends EntryRef>(orderPath: string): TEntry[] => {
  const fs = getFs()
  if (!fs.existsSync(orderPath)) return []

  const orderFile = readJsonFile<{ entries?: unknown }>(orderPath)
  if (!Array.isArray(orderFile.entries) || !orderFile.entries.every(isEntryRef)) {
    throw new Error(`Invalid order file: ${orderPath}`)
  }

  return orderFile.entries as TEntry[]
}

const writeRepairedOrder = <TEntry extends EntryRef>(
  orderPath: string,
  persistedEntries: readonly TEntry[],
  discoveredEntries: readonly TEntry[]
): TEntry[] => {
  const discoveredKeys = new Set(discoveredEntries.map((entry) => `${entry.kind}:${entry.id}`))
  const seenKeys = new Set<string>()
  const entries = persistedEntries.filter((entry) => {
    const key = `${entry.kind}:${entry.id}`
    if (!discoveredKeys.has(key) || seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

  for (const entry of discoveredEntries) {
    const key = `${entry.kind}:${entry.id}`
    if (seenKeys.has(key)) continue
    entries.push(entry)
    seenKeys.add(key)
  }

  const fs = getFs()
  if (!fs.existsSync(orderPath) || JSON.stringify(entries) !== JSON.stringify(persistedEntries)) {
    fs.mkdirSync(path.dirname(orderPath), { recursive: true })
    fs.writeFileSync(orderPath, JSON.stringify({ entries }, null, 2), 'utf8')
  }

  return entries
}

const readDirectPromptFolderRefs = (
  workspacePath: string,
  parentFolderPath: string | null
): FolderEntryRef[] => {
  const fs = getFs()
  const diskPath = parentFolderPath
    ? resolvePromptFolderPath(workspacePath, parentFolderPath)
    : path.join(workspacePath, PROMPTS_DIRECTORY_NAME)

  if (!fs.existsSync(diskPath)) return []

  return fs
    .readdirSync(diskPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()))
    .flatMap((entry) => {
      if (
        entry.name === PROMPT_FOLDER_INFO_DIRECTORY_NAME ||
        entry.name === COMPLETED_PROMPTS_FOLDER_NAME
      ) {
        return []
      }

      const folderPath = parentFolderPath ? path.join(parentFolderPath, entry.name) : entry.name
      if (!isPromptFolderDirectory(workspacePath, folderPath)) return []
      return [folderEntryRef(readPromptFolderInfo(workspacePath, folderPath).promptFolderId)]
    })
}

export const readPromptFolderEntries = (workspacePath: string, folderName: string): EntryRef[] => {
  const orderPath = resolvePromptFolderOrderPath(workspacePath, folderName)
  const persistedEntries = readOrderEntries<EntryRef>(orderPath)
  const activePromptEntries = [...readPromptStemByPromptId(workspacePath, folderName).keys()].map(
    promptEntryRef
  )
  const discoveredEntries = [
    ...activePromptEntries,
    ...readDirectPromptFolderRefs(workspacePath, folderName)
  ]
  return writeRepairedOrder(orderPath, persistedEntries, discoveredEntries)
}

const readWorkspacePromptFolderEntries = (workspacePath: string): FolderEntryRef[] => {
  const orderPath = resolveWorkspacePromptFolderOrderPath(workspacePath)
  const persistedEntries = readOrderEntries<FolderEntryRef>(orderPath)
  return writeRepairedOrder(
    orderPath,
    persistedEntries,
    readDirectPromptFolderRefs(workspacePath, null)
  )
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
  folderPath: string,
  folderName: string = folderPath
): PromptFolder => {
  const info = readPromptFolderInfo(workspacePath, folderPath)
  const folderSettings = Object.fromEntries(
    PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
      field,
      readOptionalTextFile(resolvePromptFolderSettingsTextPath(workspacePath, folderPath, field))
    ])
  ) as PromptFolderSettings
  const entries = readPromptFolderEntries(workspacePath, folderPath)
  const completedPromptIds = [
    ...readPromptStemByPromptId(workspacePath, resolveCompletedPromptFolderName(folderPath)).keys()
  ]

  return {
    id: info.promptFolderId,
    folderName,
    displayName: info.displayName,
    entries,
    completedPromptIds,
    settings: copyPromptFolderSettings(folderSettings)
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
    fallbackTitle: prompt.fallbackTitle,
    modifiedAt: prompt.modifiedAt,
    status: prompt.status,
    ...(prompt.completedAt ? { completedAt: prompt.completedAt } : {})
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

    const folderPath = entry.name
    if (!isPromptFolderDirectory(workspacePath, folderPath)) {
      continue
    }

    promptFolders.push(readPromptFolder(workspacePath, folderPath))
  }

  const promptFolderById = new Map(promptFolders.map((folder) => [folder.id, folder]))
  return readWorkspacePromptFolderEntries(workspacePath).flatMap((entry) => {
    const folder = promptFolderById.get(entry.id)
    return folder ? [folder] : []
  })
}

const isPromptFolderDirectory = (workspacePath: string, folderName: string): boolean => {
  const fs = getFs()
  return fs.existsSync(resolvePromptFolderInfoPath(workspacePath, folderName))
}

const readPromptSubfolders = (workspacePath: string, parentFolderPath: string): PromptFolder[] => {
  const fs = getFs()
  const parentDiskFolderPath = resolvePromptFolderPath(workspacePath, parentFolderPath)
  const promptFolders: PromptFolder[] = []

  if (!fs.existsSync(parentDiskFolderPath)) {
    return promptFolders
  }

  for (const entry of fs.readdirSync(parentDiskFolderPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    if (
      entry.name === PROMPT_FOLDER_INFO_DIRECTORY_NAME ||
      entry.name === COMPLETED_PROMPTS_FOLDER_NAME
    ) {
      continue
    }

    const folderPath = path.join(parentFolderPath, entry.name)
    if (!isPromptFolderDirectory(workspacePath, folderPath)) {
      continue
    }

    const promptFolder = readPromptFolder(workspacePath, folderPath, entry.name)
    promptFolders.push(promptFolder)
    promptFolders.push(...readPromptSubfolders(workspacePath, folderPath))
  }

  return promptFolders
}

export const readAllPromptFolders = (workspacePath: string): PromptFolder[] => {
  const promptFolders: PromptFolder[] = []

  for (const promptFolder of readPromptFolders(workspacePath)) {
    promptFolders.push(promptFolder)
    promptFolders.push(...readPromptSubfolders(workspacePath, promptFolder.folderName))
  }

  return promptFolders
}
