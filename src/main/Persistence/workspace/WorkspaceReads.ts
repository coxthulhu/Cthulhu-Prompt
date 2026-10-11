import { createPromptStatusFolderLayouts } from '@shared/domain/prompt-collection/PromptCollection'
import * as path from 'path'
import {
  PROMPT_STATUS_FOLDERS,
  PromptStatusFolderId,
  type PromptPersisted,
  type PromptSummaryData
} from '@shared/domain/prompt/Prompt'
import type {
  PromptTemplatePersisted,
  PromptTemplateSummaryData
} from '@shared/domain/prompt-template/PromptTemplate'
import {
  collectionEntryRef,
  promptEntryRef,
  promptTemplateEntryRef,
  type EntryRef,
  type CollectionEntryRef
} from '@shared/domain/OrderContainer'
import {
  copyPromptCollectionSettings,
  type CategoryOrder,
  type CategoryOrderEntryRef,
  type PromptCollection,
  type PromptCollectionContentKind,
  type PromptCollectionKind,
  type PromptCollectionSettings,
  type PromptStatusFolderLayouts
} from '@shared/domain/prompt-collection/PromptCollection'
import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'
import type { PromptCollectionInfoFile, WorkspaceInfoFile } from './WorkspaceDiskTypes'
import { getFs } from '../../fs-provider'
import { readJsonFile } from '../FilePersistenceHelpers'
import { parseCategoryJson } from '../CategoryPersistence'
import {
  parsePromptMarkdown,
  parsePromptTemplateMarkdown
} from '../PromptFrontmatter'
import {
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX,
  CATEGORY_FILENAME_SUFFIX,
  resolvePromptStatusFolderName,
  resolvePromptDirectoryPath,
  resolvePromptRootDirectoryName,
  resolvePromptCollectionInfoPath,
  resolvePromptCollectionCategoryOrderPath,
  resolvePromptCollectionSettingsTextPath,
  resolvePromptPathsFromStem,
  resolveCategoriesDirectoryPath,
  resolveWorkspaceCollectionOrderPath
} from '../PromptPersistencePaths'
import {
  serializePromptMarkdown,
  serializePromptTemplateMarkdown
} from '../PromptFrontmatter'
import { LATEST_WORKSPACE_SCHEMA_VERSION } from './WorkspaceMigrations'

export const readWorkspaceInfo = (workspaceInfoPath: string): WorkspaceInfoFile => {
  const parsed = readJsonFile<unknown>(workspaceInfoPath)

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 3 ||
    !Object.keys(parsed).every((key) =>
      ['schemaVersion', 'workspaceId', 'workspaceName'].includes(key)
    ) ||
    (parsed as Record<string, unknown>).schemaVersion !== LATEST_WORKSPACE_SCHEMA_VERSION ||
    typeof (parsed as Record<string, unknown>).workspaceId !== 'string' ||
    (parsed as Record<string, unknown>).workspaceId === '' ||
    typeof (parsed as Record<string, unknown>).workspaceName !== 'string' ||
    (parsed as Record<string, unknown>).workspaceName === ''
  ) {
    throw new Error('Invalid workspace info')
  }

  return parsed as WorkspaceInfoFile
}

const readPromptCollectionInfo = (
  workspacePath: string,
  folderName: string,
  kind: PromptCollectionKind
): PromptCollectionInfoFile => {
  const infoPath = resolvePromptCollectionInfoPath(workspacePath, folderName, kind)
  return readJsonFile<PromptCollectionInfoFile>(infoPath)
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
  kind: PromptCollectionKind,
  statusFolderId: PromptStatusFolderId = PromptStatusFolderId.Active
): string[] => {
  const contentKind = kind
  /** Physical ordered directory selected for prompts or the direct template collection. */
  const orderedFolderName =
    resolvePromptStatusFolderName(folderName, statusFolderId)
  const contentStemById = readContentStemById(workspacePath, orderedFolderName, contentKind)
  return readPromptCollectionCategoryOrder(
    workspacePath,
    folderName,
    kind,
    statusFolderId
  ).categories
    .flatMap((category) => category.entries)
    .filter((entry) => entry.kind === contentKind && contentStemById.has(entry.id))
    .map((entry) => entry.id)
}

const isEntryRef = (value: unknown): value is EntryRef => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    (entry.kind === 'prompt' || entry.kind === 'template' || entry.kind === 'collection') &&
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

/** Discovers one kind of collection in deterministic disk-name order. */
const readDirectWorkspaceCollectionRefs = (
  workspacePath: string,
  kind: PromptCollectionKind
): CollectionEntryRef[] => {
  const fs = getFs()
  /** Type directory containing every discoverable collection in this order. */
  const diskPath = path.join(workspacePath, resolvePromptRootDirectoryName(kind))
  /** Valid collections paired with their stable references. */
  const collections = fs
    .readdirSync(diskPath, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && isPromptCollectionDirectory(workspacePath, entry.name, kind)
    )
    .map((entry) => ({
      folderName: entry.name,
      ref: collectionEntryRef(readPromptCollectionInfo(workspacePath, entry.name, kind).collectionId)
    }))

  return collections
    .sort((left, right) =>
      left.folderName.toLowerCase().localeCompare(right.folderName.toLowerCase())
    )
    .map((collection) => collection.ref)
}

/** Reads and repairs the workspace collection order for one kind. */
export const readWorkspaceCollectionEntries = (
  workspacePath: string,
  kind: PromptCollectionKind
): CollectionEntryRef[] => {
  /** Type-owned order file repaired against collections currently on disk. */
  const orderPath = resolveWorkspaceCollectionOrderPath(workspacePath, kind)
  const persistedEntries = readOrderEntries<CollectionEntryRef>(orderPath)
  return writeRepairedOrder(
    orderPath,
    persistedEntries,
    readDirectWorkspaceCollectionRefs(workspacePath, kind)
  )
}

const readFileModifiedAt = (filePath: string): string => {
  const fs = getFs()
  return fs.statSync(filePath).mtime.toISOString()
}

const readContentStemById = (
  workspacePath: string,
  folderName: string,
  kind: PromptCollectionContentKind
): Map<string, string> => {
  const fs = getFs()
  const folderPath = resolvePromptDirectoryPath(workspacePath, folderName, kind)
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

/** Reads category IDs and their persisted filename stems from one collection. */
export const readCategoryStemById = (
  workspacePath: string,
  collectionFolderName: string,
  kind: PromptCollectionKind
): Map<string, string> => {
  const fs = getFs()
  const categoriesPath = resolveCategoriesDirectoryPath(workspacePath, collectionFolderName, kind)
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

/** Parsed ordered content used to repair category ordering and front matter together. */
type CategoryOrderContent = {
  entry: CategoryOrderEntryRef
  content: PromptPersisted | PromptTemplatePersisted
  markdownPath: string
}

/** Reports whether a persisted value is a category-order entry of the collection's content kind. */
const isCategoryOrderEntry = (
  value: unknown,
  kind: PromptCollectionContentKind
): value is CategoryOrderEntryRef => {
  if (!value || typeof value !== 'object') return false
  /** Candidate persisted entry being validated. */
  const entry = value as Record<string, unknown>
  return entry.kind === kind && typeof entry.id === 'string'
}

/** Reads and validates one existing CategoryOrder file. */
const readCategoryOrderFile = (
  orderPath: string,
  kind: PromptCollectionContentKind
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

/** Discovers all content in one ordered prompt status folder or template collection. */
const readCollectionCategoryOrderContents = (
  workspacePath: string,
  collectionFolderName: string,
  kind: PromptCollectionContentKind,
  statusFolderId: PromptStatusFolderId
): CategoryOrderContent[] => {
  /** Filesystem used for ordered-content discovery. */
  const fs = getFs()
  /** Physical collection containing every item covered by the category order. */
  const orderedCollectionPath = resolvePromptDirectoryPath(
    workspacePath,
    resolvePromptStatusFolderName(collectionFolderName, statusFolderId),
    kind
  )
  /** Filename suffix identifying the collection's content kind. */
  const filenameSuffix =
    kind === 'prompt' ? PROMPT_MARKDOWN_FILENAME_SUFFIX : PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX
  /** First valid discovered record for each stable content ID. */
  const contentById = new Map<string, CategoryOrderContent>()

  if (fs.existsSync(orderedCollectionPath)) {
    for (const entry of fs
      .readdirSync(orderedCollectionPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isFile() || !entry.name.endsWith(filenameSuffix)) continue
      /** Full path of one ordered prompt or template markdown file. */
      const entryPath = path.join(orderedCollectionPath, entry.name)
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

/** Repairs collection category groups, entry ownership, and matching content front matter. */
export const readPromptCollectionCategoryOrder = (
  workspacePath: string,
  collectionFolderName: string,
  kind: PromptCollectionContentKind,
  statusFolderId: PromptStatusFolderId = PromptStatusFolderId.Active
): CategoryOrder => {
  /** Canonical CategoryOrder path for the collection's selected status folder. */
  const orderPath = resolvePromptCollectionCategoryOrderPath(
    workspacePath,
    collectionFolderName,
    kind,
    statusFolderId
  )
  /** Filesystem used to read and repair category ordering. */
  const fs = getFs()
  /** Existing category order, or an empty starting point for first-time creation. */
  const persistedOrder = fs.existsSync(orderPath)
    ? readCategoryOrderFile(orderPath, kind)
    : kind === 'prompt' && statusFolderId === PromptStatusFolderId.Backlog
      ? {
          // Seed future work with Active's repaired category order, without its prompts.
          categories: readPromptCollectionCategoryOrder(workspacePath, collectionFolderName, kind)
            .categories.map(({ categoryId }) => ({ categoryId, entries: [] }))
        }
      : { categories: [] }
  /** Category IDs backed by valid category files for this collection. */
  const discoveredCategoryIds = [
    ...readCategoryStemById(workspacePath, collectionFolderName, kind).keys()
  ]
  /** Valid ordered content sorted by displayed name and stable ID. */
  const discoveredContents = readCollectionCategoryOrderContents(
    workspacePath,
    collectionFolderName,
    kind,
    statusFolderId
  )
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
  /** Ordered content absent from the persisted file and appended alphabetically to Uncategorized. */
  const missingEntries = discoveredContents
    .filter((content) => !acceptedContentIds.has(content.entry.id))
    .map((content) => content.entry)
  uncategorized.entries.push(...missingEntries)
  /** Fully repaired category order written to disk and exposed to the renderer. */
  const categoryOrder: CategoryOrder = {
    categories: [uncategorized, ...newCategories, ...retainedCategories]
  }
  if (!fs.existsSync(orderPath) || JSON.stringify(categoryOrder) !== JSON.stringify(persistedOrder)) {
    fs.mkdirSync(path.dirname(orderPath), { recursive: true })
    fs.writeFileSync(orderPath, JSON.stringify(categoryOrder, null, 2), 'utf8')
  }

  /** Authoritative category membership assigned by the repaired collection order. */
  const categoryIdByContentId = new Map<string, string | null>()
  for (const category of categoryOrder.categories) {
    for (const entry of category.entries) categoryIdByContentId.set(entry.id, category.categoryId)
  }
  for (const discoveredContent of discoveredContents) {
    /** Category ID that CategoryOrder assigns to this content. */
    const categoryId = categoryIdByContentId.get(discoveredContent.entry.id) ?? null
    if ((discoveredContent.content.category ?? null) === categoryId) continue
    /** Content copy whose front matter is synchronized to the collection order. */
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

export const readPromptCollection = (
  workspacePath: string,
  folderPath: string,
  folderName: string = folderPath,
  kind: PromptCollectionKind = 'prompt'
): PromptCollection => {
  const info = readPromptCollectionInfo(workspacePath, folderPath, kind)
  const collectionDescription = readOptionalTextFile(
    resolvePromptCollectionSettingsTextPath(workspacePath, folderPath, 'collectionDescription', kind)
  )
  const baseCollection = {
    id: info.collectionId,
    folderName,
    displayName: info.displayName
  }

  if (kind === 'template') {
    return {
      ...baseCollection,
      kind,
      statusFolders: createPromptStatusFolderLayouts({
        categoryOrders: { active: readPromptCollectionCategoryOrder(workspacePath, folderPath, kind) },
        promptIds: { archived: [...readPromptTemplateStemById(workspacePath, resolvePromptStatusFolderName(folderPath, PromptStatusFolderId.Archived)).keys()] }
      }),
      settings: { collectionDescription }
    }
  }

  const collectionSettings: PromptCollectionSettings = { collectionDescription }
  /** Registry-backed prompt status-folder layouts loaded from their physical directories. */
  const statusFolders = Object.fromEntries(
    PROMPT_STATUS_FOLDERS.map((statusFolder) => [
      statusFolder.id,
      statusFolder.ordering === 'category'
        ? {
            ordering: 'category' as const,
            categoryOrder: readPromptCollectionCategoryOrder(
              workspacePath,
              folderPath,
              kind,
              statusFolder.id
            )
          }
        : {
            ordering: 'finalizedAt' as const,
            promptIds: [
              ...readPromptStemByPromptId(
                workspacePath,
                resolvePromptStatusFolderName(folderPath, statusFolder.id)
              ).keys()
            ]
          }
    ])
  ) as PromptStatusFolderLayouts

  return {
    ...baseCollection,
    kind,
    statusFolders,
    settings: copyPromptCollectionSettings(collectionSettings)
  }
}

const readMarkdownContents = <TContent>(
  workspacePath: string,
  folderName: string,
  collectionKind: PromptCollectionKind,
  parseMarkdown: (fileText: string, modifiedAt: string) => TContent | null
): TContent[] => {
  const fs = getFs()
  const contentKind = collectionKind
  /** Ordered source directory used by this active-compatible reader. */
  const orderedFolderName =
    resolvePromptStatusFolderName(folderName, PromptStatusFolderId.Active)
  const contentIds = readContentIds(workspacePath, folderName, collectionKind)
  const contentStemById = readContentStemById(workspacePath, orderedFolderName, contentKind)
  const folderPath = resolvePromptDirectoryPath(workspacePath, orderedFolderName, collectionKind)
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
  collectionKind: 'prompt' = 'prompt'
): PromptPersisted[] =>
  readMarkdownContents(workspacePath, folderName, collectionKind, parsePromptMarkdown)

export const readPromptTemplates = (
  workspacePath: string,
  folderName: string
): PromptTemplatePersisted[] =>
  readMarkdownContents(workspacePath, folderName, 'template', parsePromptTemplateMarkdown)

export const readPromptSummaries = (
  workspacePath: string,
  folderName: string,
  collectionKind: 'prompt' = 'prompt'
): PromptSummaryData[] => {
  const prompts = readPrompts(workspacePath, folderName, collectionKind)
  return prompts.map((prompt) => ({
    id: prompt.id,
    title: prompt.title,
    fallbackTitle: prompt.fallbackTitle,
    modifiedAt: prompt.modifiedAt,
    status: prompt.status,
    ...(prompt.finalizedAt ? { finalizedAt: prompt.finalizedAt } : {})
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

export const readPromptCollections = (
  workspacePath: string,
  kind: PromptCollectionKind = 'prompt'
): PromptCollection[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, resolvePromptRootDirectoryName(kind))
  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })
  const promptCollections: PromptCollection[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const folderPath = entry.name
    if (!isPromptCollectionDirectory(workspacePath, folderPath, kind)) {
      continue
    }

    promptCollections.push(readPromptCollection(workspacePath, folderPath, folderPath, kind))
  }

  const promptCollectionById = new Map(promptCollections.map((collection) => [collection.id, collection]))
  return readWorkspaceCollectionEntries(workspacePath, kind).flatMap((entry) => {
    const collection = promptCollectionById.get(entry.id)
    return collection ? [collection] : []
  })
}

const isPromptCollectionDirectory = (
  workspacePath: string,
  folderName: string,
  kind: PromptCollectionKind
): boolean => {
  const fs = getFs()
  const infoPath = resolvePromptCollectionInfoPath(workspacePath, folderName, kind)
  return fs.existsSync(infoPath) && readJsonFile<PromptCollectionInfoFile>(infoPath).kind === kind
}

export const readAllPromptCollections = (
  workspacePath: string,
  kind: PromptCollectionKind = 'prompt'
): PromptCollection[] => {
  return readPromptCollections(workspacePath, kind)
}
