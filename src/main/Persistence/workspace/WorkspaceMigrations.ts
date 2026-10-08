import * as path from 'path'
import { parseMarkdownFrontmatter, serializeMarkdownFrontmatter } from '../MarkdownFrontmatter'
import type { Category } from '@shared/domain/category/Category'
import { folderEntryRef, type FolderEntryRef } from '@shared/domain/OrderContainer'
import type { PromptFolderKind } from '@shared/domain/prompt-folder/PromptFolder'
import type { WorkspaceInfoFile } from './WorkspaceDiskTypes'
import { getFs } from '../../fs-provider'
import { isCategory, parseCategoryJson } from '../CategoryPersistence'
import { allocateFilenameStem } from '@shared/domain/prompt/promptFilename'
import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'
import { readJsonFile, resolveTempPath, writeJsonFile } from '../FilePersistenceHelpers'
import {
  CATEGORY_FILENAME_SUFFIX,
  PROMPT_FOLDER_INFO_DIRECTORY_NAME,
  PROMPT_FOLDER_INFO_FILENAME,
  PROMPTS_DIRECTORY_NAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX,
  TEMPLATES_DIRECTORY_NAME,
  resolveLegacyWorkspaceFolderOrderPath,
  resolvePromptRootDirectoryName,
  resolveWorkspaceFolderOrderPath,
  resolveWorkspacePathFromInfoPath
} from '../PromptPersistencePaths'
import { parsePromptMarkdown, parsePromptTemplateMarkdown, serializePromptMarkdown } from '../PromptFrontmatter'

/** Latest schema understood by every workspace persistence reader. */
export const LATEST_WORKSPACE_SCHEMA_VERSION = 4

/** Workspace metadata accepted only while determining which migrations to run. */
type MigratableWorkspaceInfoFile = Omit<WorkspaceInfoFile, 'schemaVersion'> & {
  schemaVersion?: number
}

/** Legacy category shape accepted only by the 0 to 1 workspace migration. */
type SchemaVersionZeroCategory = Omit<Category, 'shortDescription'>

/** Legacy root-order file entry accepted by the schema-one migration. */
type SchemaVersionOneFolderOrder = {
  entries: FolderEntryRef[]
}

/** One sequential workspace schema migration. */
type WorkspaceMigration = (workspacePath: string, workspaceInfoPath: string) => void

/** Reports whether a value is a non-array object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Reads and validates workspace metadata before the current schema is guaranteed. */
const readMigratableWorkspaceInfo = (
  workspaceInfoPath: string
): MigratableWorkspaceInfoFile => {
  /** Untrusted workspace metadata read before schema migration. */
  const value = readJsonFile<unknown>(workspaceInfoPath)
  if (!isRecord(value)) throw new Error('Invalid workspace info')

  /** Persisted workspace metadata keys accepted at versions zero and one. */
  const keys = Object.keys(value)
  /** Whether the file explicitly identifies its schema version. */
  const hasSchemaVersion = Object.hasOwn(value, 'schemaVersion')
  if (
    keys.length !== (hasSchemaVersion ? 3 : 2) ||
    !keys.every((key) => ['schemaVersion', 'workspaceId', 'workspaceName'].includes(key)) ||
    typeof value.workspaceId !== 'string' ||
    value.workspaceId.length === 0 ||
    typeof value.workspaceName !== 'string' ||
    value.workspaceName.length === 0 ||
    (hasSchemaVersion &&
      (!Number.isInteger(value.schemaVersion) || (value.schemaVersion as number) < 0))
  ) {
    throw new Error('Invalid workspace info')
  }

  return {
    workspaceId: value.workspaceId,
    workspaceName: value.workspaceName,
    ...(hasSchemaVersion ? { schemaVersion: value.schemaVersion as number } : {})
  }
}

/** Recursively collects matching workspace files in deterministic path order. */
const collectWorkspaceFiles = (directoryPath: string, filenameSuffix: string): string[] => {
  /** Filesystem used to inspect the persisted workspace tree. */
  const fs = getFs()
  /** Matching files found below the current directory. */
  const filePaths: string[] = []

  for (const entry of fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    /** Full path for the current directory entry. */
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      filePaths.push(...collectWorkspaceFiles(entryPath, filenameSuffix))
    } else if (entry.isFile() && entry.name.endsWith(filenameSuffix)) {
      filePaths.push(entryPath)
    }
  }

  return filePaths
}

/** Reports whether a value is the exact legacy category shape. */
const isSchemaVersionZeroCategory = (value: unknown): value is SchemaVersionZeroCategory => {
  if (!isRecord(value)) return false

  return (
    Object.keys(value).length === 3 &&
    typeof value.id === 'string' &&
    typeof value.displayName === 'string' &&
    (typeof value.description === 'string' || value.description === null)
  )
}

/** Adds the required short description field to one legacy category file. */
const migrateCategoryToSchemaVersionOne = (categoryPath: string): void => {
  /** Untrusted category JSON inspected by the migration. */
  const value = readJsonFile<unknown>(categoryPath)
  if (isCategory(value)) return
  if (!isSchemaVersionZeroCategory(value)) {
    throw new Error(`Invalid category file: ${categoryPath}`)
  }

  writeJsonFile(categoryPath, {
    id: value.id,
    displayName: value.displayName,
    shortDescription: null,
    description: value.description
  })
}

/** Replaces one legacy prompt template ID with the current ordered template list. */
const migratePromptToSchemaVersionOne = (promptPath: string): void => {
  /** Original prompt source retained when no rewrite is required. */
  const fileText = getFs().readFileSync(promptPath, 'utf8')
  /** Parsed Markdown body and front matter inspected by the migration. */
  const parsed = parseMarkdownFrontmatter(fileText)
  if (!isRecord(parsed.data)) throw new Error(`Invalid prompt file: ${promptPath}`)

  /** Whether this prompt contains the retired singular template field. */
  const hasLegacyTemplateId = Object.hasOwn(parsed.data, 'templateId')
  if (!hasLegacyTemplateId) {
    if (!parsePromptMarkdown(fileText)) throw new Error(`Invalid prompt file: ${promptPath}`)
    return
  }

  /** Singular template value accepted only by schema version zero. */
  const templateId = parsed.data.templateId
  if (
    Object.hasOwn(parsed.data, 'templates') ||
    (templateId !== null && typeof templateId !== 'string')
  ) {
    throw new Error(`Invalid prompt file: ${promptPath}`)
  }

  /** Legacy metadata without the retired singular template field. */
  const { templateId: _templateId, ...currentMetadata } = parsed.data
  /** Schema-one source used by the strict current prompt parser. */
  const migratedSource = serializeMarkdownFrontmatter(
    {
      ...currentMetadata,
      templates: templateId === null ? null : [{ id: templateId }]
    },
    parsed.content
  )
  /** Current prompt record used to emit canonical front matter. */
  const migratedPrompt = parsePromptMarkdown(migratedSource)
  if (!migratedPrompt) throw new Error(`Invalid prompt file: ${promptPath}`)

  getFs().writeFileSync(
    promptPath,
    serializePromptMarkdown({ ...migratedPrompt, promptText: parsed.content }),
    'utf8'
  )
}

/** Migrates every workspace-owned prompt and category from schema zero to one. */
const migrateSchemaVersionZeroToOne: WorkspaceMigration = (
  workspacePath,
  workspaceInfoPath
) => {
  /** Prompt files migrated whether or not ordering metadata references them. */
  const promptPaths = collectWorkspaceFiles(
    path.join(workspacePath, PROMPTS_DIRECTORY_NAME),
    PROMPT_MARKDOWN_FILENAME_SUFFIX
  )
  /** Category roots covering both prompt and template workspace data. */
  const categoryRootPaths = [PROMPTS_DIRECTORY_NAME, TEMPLATES_DIRECTORY_NAME].map(
    (directoryName) => path.join(workspacePath, directoryName)
  )
  /** Category files migrated whether or not ordering metadata references them. */
  const categoryPaths = categoryRootPaths.flatMap((directoryPath) =>
    collectWorkspaceFiles(directoryPath, CATEGORY_FILENAME_SUFFIX)
  )

  for (const promptPath of promptPaths) migratePromptToSchemaVersionOne(promptPath)
  for (const categoryPath of categoryPaths) migrateCategoryToSchemaVersionOne(categoryPath)

  /** Version-zero workspace identity preserved when the version is committed last. */
  const workspaceInfo = readMigratableWorkspaceInfo(workspaceInfoPath)
  writeJsonFile(workspaceInfoPath, {
    schemaVersion: 1,
    workspaceId: workspaceInfo.workspaceId,
    workspaceName: workspaceInfo.workspaceName
  } satisfies WorkspaceInfoFile)
}

/** Reads the retired combined root-folder order when it exists. */
const readSchemaVersionOneFolderOrder = (workspacePath: string): FolderEntryRef[] => {
  /** Legacy root-order path present in schema-one workspaces. */
  const legacyOrderPath = resolveLegacyWorkspaceFolderOrderPath(workspacePath)
  if (!getFs().existsSync(legacyOrderPath)) return []

  /** Untrusted legacy root-order data validated before migration. */
  const value = readJsonFile<unknown>(legacyOrderPath)
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 1 ||
    !Array.isArray(value.entries) ||
    !value.entries.every(
      (entry) =>
        isRecord(entry) &&
        Object.keys(entry).length === 2 &&
        entry.kind === 'folder' &&
        typeof entry.id === 'string'
    )
  ) {
    throw new Error(`Invalid order file: ${legacyOrderPath}`)
  }

  return (value as SchemaVersionOneFolderOrder).entries
}

/** Discovers stable root-folder IDs for one kind in alphabetical disk order. */
const collectSchemaVersionOneFolderIds = (
  workspacePath: string,
  kind: PromptFolderKind
): string[] => {
  /** Root type directory inspected by this migration. */
  const rootPath = path.join(workspacePath, resolvePromptRootDirectoryName(kind))
  /** Filesystem containing the schema-one workspace. */
  const fs = getFs()
  /** Stable IDs discovered from valid type-matching root metadata. */
  const folderIds: string[] = []

  for (const entry of fs
    .readdirSync(rootPath, { withFileTypes: true })
    .filter((candidate) => candidate.isDirectory())
    .sort((left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()))) {
    /** Metadata path identifying the candidate root folder. */
    const infoPath = path.join(
      rootPath,
      entry.name,
      PROMPT_FOLDER_INFO_DIRECTORY_NAME,
      PROMPT_FOLDER_INFO_FILENAME
    )
    if (!fs.existsSync(infoPath)) continue
    /** Untrusted root metadata used only to identify its stable ID and kind. */
    const info = readJsonFile<unknown>(infoPath)
    if (!isRecord(info) || info.kind !== kind || typeof info.folderId !== 'string') continue
    folderIds.push(info.folderId)
  }

  return folderIds
}

/** Builds one type-specific order while preserving legacy relative positions. */
const buildSchemaVersionTwoFolderOrder = (
  legacyEntries: FolderEntryRef[],
  discoveredIds: string[]
): FolderEntryRef[] => {
  /** Discovered IDs eligible for the migrated order. */
  const discoveredIdSet = new Set(discoveredIds)
  /** IDs already accepted from the legacy order. */
  const acceptedIds = new Set<string>()
  /** Valid legacy entries retained in their original relative order. */
  const entries = legacyEntries.filter((entry) => {
    if (!discoveredIdSet.has(entry.id) || acceptedIds.has(entry.id)) return false
    acceptedIds.add(entry.id)
    return true
  })
  for (const folderId of discoveredIds) {
    if (acceptedIds.has(folderId)) continue
    entries.push(folderEntryRef(folderId))
  }
  return entries
}

/** Splits the schema-one combined root order into type-owned order files. */
const migrateSchemaVersionOneToTwo: WorkspaceMigration = (
  workspacePath,
  workspaceInfoPath
) => {
  /** Combined schema-one entries used to retain relative order within each kind. */
  const legacyEntries = readSchemaVersionOneFolderOrder(workspacePath)
  for (const kind of ['prompt', 'template'] as const) {
    /** Alphabetically discovered roots appended when absent from the legacy order. */
    const discoveredIds = collectSchemaVersionOneFolderIds(workspacePath, kind)
    /** Complete migrated order for the current root kind. */
    const entries = buildSchemaVersionTwoFolderOrder(legacyEntries, discoveredIds)
    writeJsonFile(resolveWorkspaceFolderOrderPath(workspacePath, kind), { entries })
  }

  /** Legacy order removed only after both replacement files have been written. */
  const legacyOrderPath = resolveLegacyWorkspaceFolderOrderPath(workspacePath)
  if (getFs().existsSync(legacyOrderPath)) getFs().rmSync(legacyOrderPath)

  /** Schema-one identity preserved while committing the new version last. */
  const workspaceInfo = readMigratableWorkspaceInfo(workspaceInfoPath)
  writeJsonFile(workspaceInfoPath, {
    schemaVersion: 2,
    workspaceId: workspaceInfo.workspaceId,
    workspaceName: workspaceInfo.workspaceName
  } satisfies WorkspaceInfoFile)
}

/** Moves schema-two templates into Active while retaining root metadata and categories. */
const migrateSchemaVersionTwoToThree: WorkspaceMigration = (workspacePath, workspaceInfoPath) => {
  /** Filesystem containing the legacy template roots. */
  const fs = getFs()
  /** Template library whose immediate directories are root folders. */
  const templatesPath = path.join(workspacePath, TEMPLATES_DIRECTORY_NAME)
  for (const entry of fs.readdirSync(templatesPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    /** Root paths preserve existing filenames and stable template IDs. */
    const rootPath = path.join(templatesPath, entry.name)
    /** Active directory receiving existing template content and ordering. */
    const activePath = path.join(rootPath, 'Active')
    fs.mkdirSync(activePath, { recursive: true })
    fs.mkdirSync(path.join(rootPath, 'Archived'), { recursive: true })
    for (const file of fs.readdirSync(rootPath, { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.template.md')) {
        fs.renameSync(path.join(rootPath, file.name), path.join(activePath, file.name))
      }
    }
    /** Legacy order is moved intact; descriptions and categories remain root-owned. */
    const orderPath = path.join(rootPath, '_FolderInfo', 'FolderOrder.json')
    if (fs.existsSync(orderPath)) {
      fs.mkdirSync(path.join(activePath, '_FolderInfo'), { recursive: true })
      fs.renameSync(orderPath, path.join(activePath, '_FolderInfo', 'FolderOrder.json'))
    }
  }
  /** Workspace identity retained when the new schema is committed last. */
  const workspaceInfo = readMigratableWorkspaceInfo(workspaceInfoPath)
  writeJsonFile(workspaceInfoPath, { ...workspaceInfo, schemaVersion: 3 })
}

/** Renames workspace content with numeric allocation while preserving bytes and timestamps. */
const migrateSchemaVersionThreeToFour: WorkspaceMigration = (workspacePath, workspaceInfoPath) => {
  /** Filesystem used to validate and rename every source before committing the version. */
  const fs = getFs()
  /** Complete migration plan grouped by physical directory, including unreferenced files. */
  const directories = new Map<string, Array<{ source: string; title: string; suffix: string }>>()
  for (const rootName of [PROMPTS_DIRECTORY_NAME, TEMPLATES_DIRECTORY_NAME]) {
    for (const suffix of [PROMPT_MARKDOWN_FILENAME_SUFFIX, PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX, CATEGORY_FILENAME_SUFFIX]) {
      for (const source of collectWorkspaceFiles(path.join(workspacePath, rootName), suffix)) {
        /** Original file is parsed only to obtain its display title; its bytes are never rewritten. */
        const text = fs.readFileSync(source, 'utf8')
        /** Current content parser validates the record before any migration rename occurs. */
        const content = suffix === CATEGORY_FILENAME_SUFFIX
          ? parseCategoryJson(text)
          : suffix === PROMPT_MARKDOWN_FILENAME_SUFFIX ? parsePromptMarkdown(text) : parsePromptTemplateMarkdown(text)
        if (!content) throw new Error(`Invalid workspace content file: ${source}`)
        /** Parent directory owns an independent filename namespace. */
        const directory = path.dirname(source)
        /** Files to allocate together after freeing only this migration's own source names. */
        const files = directories.get(directory) ?? []
        files.push({ source, title: 'displayName' in content ? content.displayName : getPromptDisplayTitle(content), suffix })
        directories.set(directory, files)
      }
    }
  }
  /** Planned renames use temporary paths so filename swaps cannot overwrite source content. */
  const renames: Array<{ source: string; target: string; temporary: string }> = []
  for (const [directory, files] of directories) {
    /** Only files participating in this migration release their existing names. */
    const sources = new Set(files.map((file) => path.basename(file.source).toLowerCase()))
    /** Other directory entries remain unavailable, including directories with matching names. */
    const occupied = new Set(fs.readdirSync(directory).map((name) => name.toLowerCase()).filter((name) => !sources.has(name)))
    for (const file of files.sort((left, right) => left.source.localeCompare(right.source))) {
      /** Numeric filename allocated against both existing entries and earlier migration targets. */
      const stem = allocateFilenameStem(file.title, file.suffix, occupied)
      /** Destination retains the exact type extension and title casing. */
      const target = path.join(directory, `${stem}${file.suffix}`)
      if (target !== file.source) renames.push({ source: file.source, target, temporary: resolveTempPath(file.source) })
    }
  }
  /** Sources staged successfully, retained for restoration if any rename fails. */
  const staged: typeof renames = []
  /** Destinations committed successfully, moved back to temporary paths before restoring sources. */
  const committed: typeof renames = []
  try {
    for (const rename of renames) {
      fs.renameSync(rename.source, rename.temporary)
      staged.push(rename)
    }
    for (const rename of renames) {
      fs.renameSync(rename.temporary, rename.target)
      committed.push(rename)
    }
    /** Schema version advances only after every content filename has been migrated. */
    const workspaceInfo = readMigratableWorkspaceInfo(workspaceInfoPath)
    writeJsonFile(workspaceInfoPath, { ...workspaceInfo, schemaVersion: 4 })
  } catch (error) {
    for (const rename of committed) fs.renameSync(rename.target, rename.temporary)
    for (const rename of staged) fs.renameSync(rename.temporary, rename.source)
    throw error
  }
}

/** Migration selected by each supported source workspace schema version. */
const WORKSPACE_MIGRATIONS: Record<number, WorkspaceMigration> = {
  0: migrateSchemaVersionZeroToOne,
  1: migrateSchemaVersionOneToTwo,
  2: migrateSchemaVersionTwoToThree,
  3: migrateSchemaVersionThreeToFour
}

/** Applies pending workspace migrations before any workspace data is hydrated. */
export const applyWorkspaceMigrations = (workspaceInfoPath: string): void => {
  /** Workspace metadata used to select the first pending migration. */
  const workspaceInfo = readMigratableWorkspaceInfo(workspaceInfoPath)
  /** Missing and explicit zero versions both identify the original workspace schema. */
  let schemaVersion = workspaceInfo.schemaVersion ?? 0
  if (schemaVersion > LATEST_WORKSPACE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported workspace schema version ${schemaVersion}. Latest supported version is ${LATEST_WORKSPACE_SCHEMA_VERSION}.`
    )
  }

  /** Workspace root containing every file governed by the info-file version. */
  const workspacePath = resolveWorkspacePathFromInfoPath(workspaceInfoPath)
  while (schemaVersion < LATEST_WORKSPACE_SCHEMA_VERSION) {
    /** Sequential migration registered for the current persisted version. */
    const migration = WORKSPACE_MIGRATIONS[schemaVersion]
    if (!migration) {
      throw new Error(`No workspace migration found for schema version ${schemaVersion}.`)
    }
    migration(workspacePath, workspaceInfoPath)
    schemaVersion += 1
  }
}
