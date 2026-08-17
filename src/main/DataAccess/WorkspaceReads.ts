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
  type CategoryOrder,
  type CategoryOrderEntryRef,
  type PromptFolder,
  type PromptFolderContentKind,
  type PromptFolderKind,
  type PromptFolderSettings
} from '@shared/PromptFolder'
import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
import type { PromptFolderInfoFile, WorkspaceInfoFile } from '../DiskTypes/WorkspaceDiskTypes'
import { getFs } from '../fs-provider'
import { readJsonFile } from '../Persistence/FilePersistenceHelpers'
import { parseCategoryJson } from '../Persistence/CategoryPersistence'
import {
  parsePromptMarkdown,
  parsePromptTemplateMarkdown
} from '../Persistence/PromptFrontmatter'
import {
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX,
  CATEGORY_FILENAME_SUFFIX,
  resolveActivePromptFolderName,
  resolvePromptFolderPath,
  resolvePromptRootDirectoryName,
  resolvePromptFolderInfoPath,
  resolvePromptFolderCategoryOrderPath,
  resolveCompletedPromptFolderName,
  resolvePromptFolderSettingsTextPath,
  resolvePromptPathsFromStem,
  resolveCategoriesDirectoryPath,
  resolveWorkspaceFolderOrderPath
} from '../Persistence/PromptPersistencePaths'
import {
  serializePromptMarkdown,
  serializePromptTemplateMarkdown
} from '../Persistence/PromptFrontmatter'

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
  const contentKind = kind
  const activeFolderName = resolveActivePromptFolderName(folderName, kind)
  const contentStemById = readContentStemById(workspacePath, activeFolderName, contentKind)
  return readPromptFolderCategoryOrder(workspacePath, folderName, kind).categories
    .flatMap((category) => category.entries)
    .filter((entry) => entry.kind === contentKind && contentStemById.has(entry.id))
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
      return left.kind === right.kind ? 0 : left.kind === 'template' ? 1 : -1
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
  kind: PromptFolderContentKind
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

/** Reads category IDs and their persisted filename stems from one root folder. */
export const readCategoryStemById = (
  workspacePath: string,
  rootFolderName: string,
  kind: PromptFolderKind
): Map<string, string> => {
  const fs = getFs()
  const categoriesPath = resolveCategoriesDirectoryPath(workspacePath, rootFolderName, kind)
  const categoryStemById = new Map<string, string>()
  if (!fs.existsSync(categoriesPath)) return categoryStemById

  for (const entry of fs.readdirSync(categoriesPath, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(CATEGORY_FILENAME_SUFFIX)) continue
    const category = parseCategoryJson(
      fs.readFileSync(path.join(categoriesPath, entry.name), 'utf8')
    )
    if (!category) continue
    categoryStemById.set(category.id, entry.name.slice(0, -CATEGORY_FILENAME_SUFFIX.length))
  }

  return categoryStemById
}

/** Parsed active content used to repair category ordering and front matter together. */
type CategoryOrderContent = {
  entry: CategoryOrderEntryRef
  content: PromptPersisted | PromptTemplatePersisted
  markdownPath: string
}

/** Reports whether a persisted value is a category-order entry of the root's content kind. */
const isCategoryOrderEntry = (
  value: unknown,
  kind: PromptFolderContentKind
): value is CategoryOrderEntryRef => {
  if (!value || typeof value !== 'object') return false
  /** Candidate persisted entry being validated. */
  const entry = value as Record<string, unknown>
  return entry.kind === kind && typeof entry.id === 'string'
}

/** Reads and validates one existing FolderOrderV2 file. */
const readCategoryOrderFile = (
  orderPath: string,
  kind: PromptFolderContentKind
): CategoryOrder => {
  /** Untrusted JSON shape read from the category ordering file. */
  const value = readJsonFile<{ categories?: unknown }>(orderPath)
  if (!Array.isArray(value.categories)) throw new Error(`Invalid order file: ${orderPath}`)

  /** Fully validated category groups retained in persisted order. */
  const categories = value.categories.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    /** Candidate persisted category group being validated. */
    const category = candidate as Record<string, unknown>
    if (
      category.categoryId !== null &&
      typeof category.categoryId !== 'string'
    ) {
      return []
    }
    if (
      !Array.isArray(category.entries) ||
      !category.entries.every((entry) => isCategoryOrderEntry(entry, kind))
    ) {
      return []
    }
    return [
      {
        categoryId: category.categoryId,
        entries: category.entries as CategoryOrderEntryRef[]
      }
    ]
  })
  if (categories.length !== value.categories.length) {
    throw new Error(`Invalid order file: ${orderPath}`)
  }
  return { categories }
}

/** Discovers all active content in the root's flat active directory. */
const readRootCategoryOrderContents = (
  workspacePath: string,
  rootFolderName: string,
  kind: PromptFolderContentKind
): CategoryOrderContent[] => {
  /** Filesystem used for active-content discovery. */
  const fs = getFs()
  /** Physical root containing every active item covered by the category order. */
  const activeRootPath = resolvePromptFolderPath(
    workspacePath,
    resolveActivePromptFolderName(rootFolderName, kind),
    kind
  )
  /** Filename suffix identifying the root's content kind. */
  const filenameSuffix =
    kind === 'prompt' ? PROMPT_MARKDOWN_FILENAME_SUFFIX : PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX
  /** First valid discovered record for each stable content ID. */
  const contentById = new Map<string, CategoryOrderContent>()

  if (fs.existsSync(activeRootPath)) {
    for (const entry of fs
      .readdirSync(activeRootPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isFile() || !entry.name.endsWith(filenameSuffix)) continue
      /** Full path of one active prompt or template markdown file. */
      const entryPath = path.join(activeRootPath, entry.name)
      /** Parsed content whose stable ID participates in category ordering. */
      const content =
        kind === 'prompt'
          ? parsePromptMarkdown(fs.readFileSync(entryPath, 'utf8'))
          : parsePromptTemplateMarkdown(fs.readFileSync(entryPath, 'utf8'))
      if (!content || contentById.has(content.id)) continue
      contentById.set(content.id, {
        entry: kind === 'prompt' ? promptEntryRef(content.id) : promptTemplateEntryRef(content.id),
        content,
        markdownPath: entryPath
      })
    }
  }
  return [...contentById.values()].sort((left, right) => {
    /** Case-insensitive displayed-name comparison requested for repaired entries. */
    const nameComparison = getPromptDisplayTitle(left.content)
      .toLocaleLowerCase()
      .localeCompare(getPromptDisplayTitle(right.content).toLocaleLowerCase())
    return nameComparison || left.entry.id.localeCompare(right.entry.id)
  })
}

/** Repairs root category groups, entry ownership, and matching content front matter. */
export const readPromptFolderCategoryOrder = (
  workspacePath: string,
  rootFolderName: string,
  kind: PromptFolderContentKind
): CategoryOrder => {
  /** Canonical FolderOrderV2 path for the root. */
  const orderPath = resolvePromptFolderCategoryOrderPath(workspacePath, rootFolderName, kind)
  /** Filesystem used to read and repair category ordering. */
  const fs = getFs()
  /** Existing category order, or an empty starting point for first-time creation. */
  const persistedOrder = fs.existsSync(orderPath)
    ? readCategoryOrderFile(orderPath, kind)
    : { categories: [] }
  /** Category IDs backed by valid category files for this root. */
  const discoveredCategoryIds = [
    ...readCategoryStemById(workspacePath, rootFolderName, kind).keys()
  ]
  /** Valid active content sorted by displayed name and stable ID. */
  const discoveredContents = readRootCategoryOrderContents(workspacePath, rootFolderName, kind)
  /** Discovered content lookup used to remove stale references. */
  const contentById = new Map(discoveredContents.map((content) => [content.entry.id, content]))
  /** Valid category membership lookup used to remove deleted groups. */
  const discoveredCategoryIdSet = new Set(discoveredCategoryIds)
  /** Content IDs already accepted into exactly one repaired group. */
  const acceptedContentIds = new Set<string>()
  /** Uncategorized group that is always emitted first. */
  const uncategorized = { categoryId: null, entries: [] as CategoryOrderEntryRef[] }
  /** Valid persisted category groups retained in their existing UI order. */
  const retainedCategories: CategoryOrder['categories'] = []
  /** Retained group lookup that merges duplicate persisted category groups. */
  const retainedCategoryById = new Map<string, CategoryOrder['categories'][number]>()

  for (const persistedCategory of persistedOrder.categories) {
    /** Repaired target group, with deleted categories redirected to Uncategorized. */
    const targetCategory =
      persistedCategory.categoryId !== null &&
      discoveredCategoryIdSet.has(persistedCategory.categoryId)
        ? (() => {
            /** Existing retained group for a duplicate persisted category. */
            const existing = retainedCategoryById.get(persistedCategory.categoryId!)
            if (existing) return existing
            /** First retained group for this valid category. */
            const created = { categoryId: persistedCategory.categoryId, entries: [] }
            retainedCategoryById.set(persistedCategory.categoryId, created)
            retainedCategories.push(created)
            return created
          })()
        : uncategorized

    for (const entry of persistedCategory.entries) {
      if (!contentById.has(entry.id) || acceptedContentIds.has(entry.id)) continue
      targetCategory.entries.push(entry)
      acceptedContentIds.add(entry.id)
    }
  }

  /** Newly discovered categories inserted together at index 1. */
  const newCategories = discoveredCategoryIds
    .filter((categoryId) => !retainedCategoryById.has(categoryId))
    .map((categoryId) => ({ categoryId, entries: [] as CategoryOrderEntryRef[] }))
  /** Active content absent from the persisted file and appended alphabetically to Uncategorized. */
  const missingEntries = discoveredContents
    .filter((content) => !acceptedContentIds.has(content.entry.id))
    .map((content) => content.entry)
  uncategorized.entries.push(...missingEntries)
  /** Fully repaired category order written to disk and exposed to the renderer. */
  const categoryOrder: CategoryOrder = {
    categories: [uncategorized, ...newCategories, ...retainedCategories]
  }
  if (JSON.stringify(categoryOrder) !== JSON.stringify(persistedOrder)) {
    fs.mkdirSync(path.dirname(orderPath), { recursive: true })
    fs.writeFileSync(orderPath, JSON.stringify(categoryOrder, null, 2), 'utf8')
  }

  /** Authoritative category membership assigned by the repaired V2 order. */
  const categoryIdByContentId = new Map<string, string | null>()
  for (const category of categoryOrder.categories) {
    for (const entry of category.entries) categoryIdByContentId.set(entry.id, category.categoryId)
  }
  for (const discoveredContent of discoveredContents) {
    /** Category ID that FolderOrderV2 assigns to this content. */
    const categoryId = categoryIdByContentId.get(discoveredContent.entry.id) ?? null
    if ((discoveredContent.content.category ?? null) === categoryId) continue
    /** Content copy whose front matter is synchronized to the V2 owner. */
    const synchronizedContent = { ...discoveredContent.content }
    if (categoryId === null) delete synchronizedContent.category
    else synchronizedContent.category = categoryId
    fs.writeFileSync(
      discoveredContent.markdownPath,
      kind === 'prompt'
        ? serializePromptMarkdown(synchronizedContent as PromptPersisted)
        : serializePromptTemplateMarkdown(synchronizedContent as PromptTemplatePersisted),
      'utf8'
    )
  }

  return categoryOrder
}

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
  const completedPromptIds =
    kind === 'prompt' && folderName === folderPath
      ? [
          ...readPromptStemByPromptId(
            workspacePath,
            resolveCompletedPromptFolderName(folderPath, kind)
          ).keys()
        ]
      : []
  /** Root-owned category ordering. */
  const categoryOrder = readPromptFolderCategoryOrder(workspacePath, folderPath, kind)

  const baseFolder = {
    id: info.folderId,
    folderName,
    displayName: info.displayName,
    completedPromptIds,
    categoryOrder
  }

  if (kind === 'template') {
    return {
      ...baseFolder,
      kind,
      settings: { folderDescription }
    }
  }

  const folderSettings: PromptFolderSettings = { folderDescription }

  return {
    ...baseFolder,
    kind,
    settings: copyPromptFolderSettings(folderSettings)
  }
}

const readMarkdownContents = <TContent>(
  workspacePath: string,
  folderName: string,
  folderKind: PromptFolderKind,
  parseMarkdown: (fileText: string, modifiedAt: string) => TContent | null
): TContent[] => {
  const fs = getFs()
  const contentKind = folderKind
  const activeFolderName = resolveActivePromptFolderName(folderName, folderKind)
  const contentIds = readContentIds(workspacePath, folderName, folderKind)
  const contentStemById = readContentStemById(workspacePath, activeFolderName, contentKind)
  const folderPath = resolvePromptFolderPath(workspacePath, activeFolderName, folderKind)
  const contents: TContent[] = []
  for (const contentId of contentIds) {
    const contentStem = contentStemById.get(contentId)
    if (!contentStem) continue
    const contentPaths = resolvePromptPathsFromStem(folderPath, contentStem, contentKind)
    if (!fs.existsSync(contentPaths.markdownPath)) continue
    const content = parseMarkdown(
      fs.readFileSync(contentPaths.markdownPath, 'utf8'),
      readFileModifiedAt(contentPaths.markdownPath)
    )
    if (content) contents.push(content)
  }
  return contents
}

export const readPrompts = (
  workspacePath: string,
  folderName: string,
  folderKind: 'prompt' = 'prompt'
): PromptPersisted[] =>
  readMarkdownContents(workspacePath, folderName, folderKind, parsePromptMarkdown)

export const readPromptTemplates = (
  workspacePath: string,
  folderName: string
): PromptTemplatePersisted[] =>
  readMarkdownContents(workspacePath, folderName, 'template', parsePromptTemplateMarkdown)

export const readPromptSummaries = (
  workspacePath: string,
  folderName: string,
  folderKind: 'prompt' = 'prompt'
): PromptSummaryData[] => {
  const prompts = readPrompts(workspacePath, folderName, folderKind)
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
  const infoPath = resolvePromptFolderInfoPath(workspacePath, folderName, kind)
  return fs.existsSync(infoPath) && readJsonFile<PromptFolderInfoFile>(infoPath).kind === kind
}

export const readAllPromptFolders = (
  workspacePath: string,
  kind: PromptFolderKind = 'prompt'
): PromptFolder[] => {
  return readPromptFolders(workspacePath, kind)
}
