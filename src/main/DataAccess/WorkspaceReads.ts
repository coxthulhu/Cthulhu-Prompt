import * as path from 'path'
import type { PromptPersisted, PromptSummaryData } from '@shared/Prompt'
import type {
  PromptTemplatePersisted,
  PromptTemplateSummaryData
} from '@shared/PromptTemplate'
import {
  folderEntryRef,
  promptEntryRef,
  promptTemplateEntryRef,
  type EntryRef,
  type FolderEntryRef
} from '@shared/OrderContainer'
import {
  copyPromptFolderSettings,
  type PromptFolder,
  type PromptFolderKind,
  type PromptFolderSettings
} from '@shared/PromptFolder'
import type { PromptFolderInfoFile, WorkspaceInfoFile } from '../DiskTypes/WorkspaceDiskTypes'
import { getFs } from '../fs-provider'
import { readJsonFile } from '../Persistence/FilePersistenceHelpers'
import {
  parsePromptMarkdown,
  parsePromptTemplateMarkdown
} from '../Persistence/PromptFrontmatter'
import {
  COMPLETED_PROMPTS_FOLDER_NAME,
  PROMPT_FOLDER_INFO_DIRECTORY_NAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX,
  resolvePromptFolderPath,
  resolvePromptRootDirectoryName,
  resolvePromptFolderInfoPath,
  resolvePromptFolderOrderPath,
  resolveCompletedPromptFolderName,
  resolvePromptFolderSettingsTextPath,
  resolvePromptPathsFromStem,
  resolveWorkspaceFolderOrderPath
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
  folderName: string,
  kind: PromptFolderKind
): PromptFolderInfoFile => {
  const infoPath = resolvePromptFolderInfoPath(workspacePath, folderName, kind)
  return readJsonFile<PromptFolderInfoFile>(infoPath)
}

const readOptionalTextFile = (filePath: string): string | null => {
  const fs = getFs()

  if (!fs.existsSync(filePath)) {
    return null
  }

  return fs.readFileSync(filePath, 'utf8')
}

const readContentIds = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind
): string[] => {
  const contentStemById = readContentStemById(workspacePath, folderName, kind)
  return readPromptFolderEntries(workspacePath, folderName, kind)
    .filter((entry) => entry.kind === kind && contentStemById.has(entry.id))
    .map((entry) => entry.id)
}

const isEntryRef = (value: unknown): value is EntryRef => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    (entry.kind === 'prompt' || entry.kind === 'template' || entry.kind === 'folder') &&
    typeof entry.id === 'string'
  )
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
  parentFolderPath: string | null,
  kind: PromptFolderKind
): FolderEntryRef[] => {
  const fs = getFs()
  const diskPath = parentFolderPath
    ? resolvePromptFolderPath(workspacePath, parentFolderPath, kind)
    : path.join(workspacePath, resolvePromptRootDirectoryName(kind))

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
      if (!isPromptFolderDirectory(workspacePath, folderPath, kind)) return []
      return [folderEntryRef(readPromptFolderInfo(workspacePath, folderPath, kind).folderId)]
    })
}

export const readPromptFolderEntries = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind = 'prompt'
): EntryRef[] => {
  const orderPath = resolvePromptFolderOrderPath(workspacePath, folderName, kind)
  const persistedEntries = readOrderEntries<EntryRef>(orderPath)
  const activeContentEntries = [
    ...readContentStemById(workspacePath, folderName, kind).keys()
  ].map((id) => (kind === 'prompt' ? promptEntryRef(id) : promptTemplateEntryRef(id)))
  const discoveredEntries = [
    ...activeContentEntries,
    ...readDirectPromptFolderRefs(workspacePath, folderName, kind)
  ]
  return writeRepairedOrder(orderPath, persistedEntries, discoveredEntries)
}

const readDirectWorkspaceFolderRefs = (workspacePath: string): FolderEntryRef[] => {
  const fs = getFs()
  const folders = (['prompt', 'template'] as const).flatMap((kind) => {
    const diskPath = path.join(workspacePath, resolvePromptRootDirectoryName(kind))

    return fs
      .readdirSync(diskPath, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && isPromptFolderDirectory(workspacePath, entry.name, kind)
      )
      .map((entry) => ({
        folderName: entry.name,
        kind,
        ref: folderEntryRef(readPromptFolderInfo(workspacePath, entry.name, kind).folderId)
      }))
  })

  return folders
    .sort((left, right) => {
      const nameComparison = left.folderName
        .toLowerCase()
        .localeCompare(right.folderName.toLowerCase())
      if (nameComparison !== 0) return nameComparison
      return left.kind === right.kind ? 0 : left.kind === 'prompt' ? -1 : 1
    })
    .map((folder) => folder.ref)
}

export const readWorkspaceFolderEntries = (workspacePath: string): FolderEntryRef[] => {
  const orderPath = resolveWorkspaceFolderOrderPath(workspacePath)
  const persistedEntries = readOrderEntries<FolderEntryRef>(orderPath)
  return writeRepairedOrder(
    orderPath,
    persistedEntries,
    readDirectWorkspaceFolderRefs(workspacePath)
  )
}

const readFileModifiedAt = (filePath: string): string => {
  const fs = getFs()
  return fs.statSync(filePath).mtime.toISOString()
}

const readContentStemById = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind
): Map<string, string> => {
  const fs = getFs()
  const folderPath = resolvePromptFolderPath(workspacePath, folderName, kind)
  const contentStemById = new Map<string, string>()

  if (!fs.existsSync(folderPath)) {
    return contentStemById
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  const filenameSuffix =
    kind === 'prompt' ? PROMPT_MARKDOWN_FILENAME_SUFFIX : PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(filenameSuffix)) {
      continue
    }

    const contentStem = entry.name.slice(0, -filenameSuffix.length)
    const fileText = fs.readFileSync(path.join(folderPath, entry.name), 'utf8')
    const content =
      kind === 'prompt'
        ? parsePromptMarkdown(fileText)
        : parsePromptTemplateMarkdown(fileText)
    if (!content) {
      continue
    }
    contentStemById.set(content.id, contentStem)
  }

  return contentStemById
}

export const readPromptStemByPromptId = (
  workspacePath: string,
  folderName: string
): Map<string, string> => readContentStemById(workspacePath, folderName, 'prompt')

export const readPromptTemplateStemById = (
  workspacePath: string,
  folderName: string
): Map<string, string> => readContentStemById(workspacePath, folderName, 'template')

export const readPromptFolder = (
  workspacePath: string,
  folderPath: string,
  folderName: string = folderPath,
  kind: PromptFolderKind = 'prompt'
): PromptFolder => {
  const info = readPromptFolderInfo(workspacePath, folderPath, kind)
  const folderDescription = readOptionalTextFile(
    resolvePromptFolderSettingsTextPath(workspacePath, folderPath, 'folderDescription', kind)
  )
  const entries = readPromptFolderEntries(workspacePath, folderPath, kind)
  const completedPromptIds =
    kind === 'prompt'
      ? [
          ...readPromptStemByPromptId(
            workspacePath,
            resolveCompletedPromptFolderName(folderPath)
          ).keys()
        ]
      : []

  const baseFolder = {
    id: info.folderId,
    folderName,
    displayName: info.displayName,
    entries,
    completedPromptIds
  }

  if (kind === 'template') {
    return {
      ...baseFolder,
      kind,
      settings: { folderDescription }
    }
  }

  const folderSettings: PromptFolderSettings = {
    folderDescription,
    folderPrefix: readOptionalTextFile(
      resolvePromptFolderSettingsTextPath(workspacePath, folderPath, 'folderPrefix', kind)
    ),
    folderSuffix: readOptionalTextFile(
      resolvePromptFolderSettingsTextPath(workspacePath, folderPath, 'folderSuffix', kind)
    )
  }

  return {
    ...baseFolder,
    kind,
    settings: copyPromptFolderSettings(folderSettings)
  }
}

const readMarkdownContents = <TContent>(
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind,
  parseMarkdown: (fileText: string, modifiedAt: string) => TContent | null
): TContent[] => {
  const fs = getFs()
  const contentIds = readContentIds(workspacePath, folderName, kind)
  const contentStemById = readContentStemById(workspacePath, folderName, kind)
  const folderPath = resolvePromptFolderPath(workspacePath, folderName, kind)
  const contents: TContent[] = []
  for (const contentId of contentIds) {
    const contentStem = contentStemById.get(contentId)
    if (!contentStem) continue
    const contentPaths = resolvePromptPathsFromStem(folderPath, contentStem, kind)
    if (!fs.existsSync(contentPaths.markdownPath)) continue
    const content = parseMarkdown(
      fs.readFileSync(contentPaths.markdownPath, 'utf8'),
      readFileModifiedAt(contentPaths.markdownPath)
    )
    if (content) contents.push(content)
  }
  return contents
}

export const readPrompts = (workspacePath: string, folderName: string): PromptPersisted[] =>
  readMarkdownContents(workspacePath, folderName, 'prompt', parsePromptMarkdown)

export const readPromptTemplates = (
  workspacePath: string,
  folderName: string
): PromptTemplatePersisted[] =>
  readMarkdownContents(workspacePath, folderName, 'template', parsePromptTemplateMarkdown)

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

export const readPromptTemplateSummaries = (
  workspacePath: string,
  folderName: string
): PromptTemplateSummaryData[] => {
  return readPromptTemplates(workspacePath, folderName).map((template) => ({
    id: template.id,
    title: template.title,
    fallbackTitle: template.fallbackTitle,
    modifiedAt: template.modifiedAt
  }))
}

export const readPromptFolders = (
  workspacePath: string,
  kind: PromptFolderKind = 'prompt'
): PromptFolder[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, resolvePromptRootDirectoryName(kind))
  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })
  const promptFolders: PromptFolder[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const folderPath = entry.name
    if (!isPromptFolderDirectory(workspacePath, folderPath, kind)) {
      continue
    }

    promptFolders.push(readPromptFolder(workspacePath, folderPath, folderPath, kind))
  }

  const promptFolderById = new Map(promptFolders.map((folder) => [folder.id, folder]))
  return readWorkspaceFolderEntries(workspacePath).flatMap((entry) => {
    const folder = promptFolderById.get(entry.id)
    return folder ? [folder] : []
  })
}

const isPromptFolderDirectory = (
  workspacePath: string,
  folderName: string,
  kind: PromptFolderKind
): boolean => {
  const fs = getFs()
  return fs.existsSync(resolvePromptFolderInfoPath(workspacePath, folderName, kind))
}

const readPromptSubfolders = (
  workspacePath: string,
  parentFolderPath: string,
  kind: PromptFolderKind
): PromptFolder[] => {
  const fs = getFs()
  const parentDiskFolderPath = resolvePromptFolderPath(workspacePath, parentFolderPath, kind)
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
    if (!isPromptFolderDirectory(workspacePath, folderPath, kind)) {
      continue
    }

    const promptFolder = readPromptFolder(workspacePath, folderPath, entry.name, kind)
    promptFolders.push(promptFolder)
    promptFolders.push(...readPromptSubfolders(workspacePath, folderPath, kind))
  }

  return promptFolders
}

export const readAllPromptFolders = (
  workspacePath: string,
  kind: PromptFolderKind = 'prompt'
): PromptFolder[] => {
  const promptFolders: PromptFolder[] = []

  for (const promptFolder of readPromptFolders(workspacePath, kind)) {
    promptFolders.push(promptFolder)
    promptFolders.push(...readPromptSubfolders(workspacePath, promptFolder.folderName, kind))
  }

  return promptFolders
}
