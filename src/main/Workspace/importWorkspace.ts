import { basename, dirname, join } from 'node:path'
import { getFs } from '../fs-provider'
import { collectionEntryRef } from '@shared/domain/OrderContainer'
import { getContentStatusFolders } from '@shared/domain/prompt/Prompt'
import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'
import { createPromptStatusFolderLayouts, PROMPT_COLLECTION_SETTINGS_DISK_FILENAMES, type CategoryOrder, type CategoryOrderEntryRef, type PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { prepareProjectInfo, type Project } from '@shared/domain/workspace/Project'
import { parseCategoryJson } from '../Persistence/CategoryPersistence'
import { parsePromptMarkdown, parsePromptTemplateMarkdown } from '../Persistence/PromptFrontmatter'
import { parseNoteMarkdown } from '../Persistence/NoteFrontmatter'
import { readProjectInfo, PROJECT_INFO_FILENAME } from '../Persistence/workspace/ProjectReads'
import { normalizeContentForStatusFolder } from '../Persistence/StatusFolderNormalization'
import { emptyContents, publishWorkspace, type WorkspaceContents } from '../Persistence/sqlite/WorkspaceDatabase'

/** Reads JSON and identifies the source when JSON syntax is invalid. */
const jsonFile = (path: string) => {
  try { return JSON.parse(getFs().readFileSync(path, 'utf8')) }
  catch (error) { throw new Error(`${path}: ${String(error)}`) }
}

/** Names of immediate directories or matching files in a recognized content directory. */
const entries = (path: string, suffix?: string): string[] => getFs().readdirSync(path, { withFileTypes: true })
  .filter((entry) => suffix === undefined ? entry.isDirectory() : entry.isFile() && entry.name.endsWith(suffix))
  .map((entry) => entry.name).sort()

/** Ordered records carry their source identity and title for the version-eight fallback order. */
type OrderedContent = { ref: CategoryOrderEntryRef; title: string; content: { category?: string } }

/** Builds the canonical order in memory and rejects broken references in any supplied file. */
const readOrder = (path: string, categories: string[], contents: OrderedContent[], inherited?: CategoryOrder): CategoryOrder => {
  /** A missing order uses the v8 in-memory fallback. */
  const supplied = getFs().existsSync(path)
  /** Explicit order is authoritative for category membership. */
  const order: CategoryOrder = supplied ? jsonFile(path) : {
    categories: inherited?.categories.map(({ categoryId }) => ({ categoryId, entries: [] })) ?? []
  }
  /** Removing each referenced ID detects duplicates and identifies unlisted records. */
  const remaining = new Map(contents.map((item) => [item.ref.id, item]))
  /** Every category, including Uncategorized, can appear once per status. */
  const groups = new Set<string | null>()
  if (!Array.isArray(order?.categories)) throw new Error('Invalid category order: ' + path)
  for (const group of order.categories) {
    if (!group || groups.has(group.categoryId) || (group.categoryId !== null && !categories.includes(group.categoryId)) ||
      !Array.isArray(group.entries)) throw new Error('Invalid category group: ' + path)
    groups.add(group.categoryId)
    for (const ref of group.entries) {
      /** A supplied reference must identify content in this status folder. */
      const item = remaining.get(ref?.id)
      if (!item || ref.kind !== item.ref.kind) throw new Error('Invalid category order reference: ' + path)
      if (group.categoryId === null) delete item.content.category
      else item.content.category = group.categoryId
      remaining.delete(ref.id)
    }
  }
  /** Unlisted records are appended to the default group. */
  const uncategorized = order.categories.find((group) => group.categoryId === null) ?? { categoryId: null, entries: [] }
  for (const item of [...remaining.values()].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.ref.id.localeCompare(b.ref.id))) {
    delete item.content.category
    uncategorized.entries.push(item.ref)
  }
  return { categories: [uncategorized, ...categories.filter((id) => !groups.has(id)).map((categoryId) => ({ categoryId, entries: [] })),
    ...order.categories.filter((group) => group.categoryId !== null)] }
}

/** Reads only v8 collection-owned files and builds independent records for each status and attachment. */
const readCollection = (source: WorkspaceContents, projectPath: string, folder: string, kind: 'prompt' | 'template'): PromptCollection => {
  /** Each project has separate prompt and template libraries. */
  const directory = join(projectPath, kind === 'prompt' ? 'Prompts' : 'Templates', folder)
  /** Collection identity is stored beside its status directories. */
  const infoPath = join(directory, '_CollectionInfo.json')
  /** The marker distinguishes prompt collections from template collections. */
  const info = jsonFile(infoPath)
  if (!info || !info.collectionId || typeof info.collectionId !== 'string' || typeof info.displayName !== 'string' || info.kind !== kind) throw new Error('Invalid collection: ' + infoPath)
  /** Categories belong to one collection across its statuses. */
  const categoryDir = join(directory, 'Categories')
  /** Preserve category identities while reading their independent records. */
  const categoryIds = (getFs().existsSync(categoryDir) ? entries(categoryDir, '.category.json') : []).map((name) => {
    /** Each category file contains one domain record. */
    const path = join(categoryDir, name)
    /** Normalize category metadata with the v8 reader. */
    const category = parseCategoryJson(getFs().readFileSync(path, 'utf8'))
    if (!category) throw new Error('Invalid category: ' + path)
    source.category.push(category)
    return category.id
  })
  /** Legacy descriptions are plain Markdown under the collection metadata directory. */
  const descriptionPath = join(directory, '_CollectionInfo', PROMPT_COLLECTION_SETTINGS_DISK_FILENAMES.collectionDescription)
  /** Assemble status membership while retaining the collection ID. */
  const collection: PromptCollection = { id: info.collectionId, displayName: info.displayName, folderName: folder, kind,
    settings: { collectionDescription: getFs().existsSync(descriptionPath) ? getFs().readFileSync(descriptionPath, 'utf8') : null },
    statusFolders: createPromptStatusFolderLayouts() }
  for (const status of getContentStatusFolders(kind)) {
    /** The physical status owns legacy workflow membership. */
    const statusPath = join(directory, status.directoryName)
    /** Final statuses use ID lists while active statuses use category groups. */
    const layout = collection.statusFolders[status.id]
    /** Collect eligible content before validating this status’s order file. */
    const ordered: OrderedContent[] = []
    /** Note files with identity-only front matter belong to an owner. */
    const attachments = new Set<string>()
    /** Every owner reference must resolve to one attachment in this directory. */
    const owners = new Set<string>()
    for (const filename of getFs().existsSync(statusPath) ? entries(statusPath, '.md') : []) {
      /** Read the Markdown source from its original status directory. */
      const path = join(statusPath, filename)
      /** Both collection kinds can contain note files. */
      const isNote = filename.endsWith('.note.md')
      if (!isNote && !filename.endsWith(kind === 'prompt' ? '.prompt.md' : '.template.md')) continue
      /** Parse the original bytes without rewriting the source. */
      const text = getFs().readFileSync(path, 'utf8')
      /** Legacy modification timestamps come from the filesystem. */
      const modified = getFs().statSync(path).mtime.toISOString()
      /** Select the v8 reader for the recognized filename suffix. */
      const parsed = isNote ? parseNoteMarkdown(text, modified) : kind === 'prompt' ? parsePromptMarkdown(text, modified) : parsePromptTemplateMarkdown(text, modified)
      if (!parsed || !parsed.id) throw new Error('Invalid workspace content: ' + path)
      if ('kind' in parsed && parsed.kind === 'attached') {
        attachments.add(parsed.id)
        source.note.push(parsed)
        continue
      }
      /** Retain the old loader’s status normalization in memory. */
      const record = normalizeContentForStatusFolder(parsed, statusPath, kind)
      if ('promptText' in record) source.prompt.push(record)
      else if ('templateText' in record) source.promptTemplate.push(record)
      else source.note.push(record)
      if ('attachedNoteId' in record && record.attachedNoteId) {
        if (owners.has(record.attachedNoteId)) throw new Error('Duplicate attached note reference: ' + path)
        owners.add(record.attachedNoteId)
      }
      if (layout.ordering === 'category') ordered.push({ ref: { kind: isNote ? 'note' : kind, id: record.id }, title: getPromptDisplayTitle(record), content: record })
      else (isNote ? layout.noteIds : layout.promptIds).push(record.id)
    }
    if (attachments.size !== owners.size || [...owners].some((id) => !attachments.has(id))) throw new Error('Invalid attached note reference in ' + statusPath)
    if (layout.ordering === 'category') layout.categoryOrder = readOrder(join(statusPath, '_CategoryOrder.json'), categoryIds, ordered,
      status.id === 'backlog' ? collection.statusFolders.active.categoryOrder : undefined)
  }
  return collection
}

/** Imports one current-format legacy workspace without opening it or writing to the source. */
export const importWorkspace = (path: string): string => {
  if (!/\.cthulhuprompt(?:\.json)?$/i.test(path)) throw new Error('Invalid workspace file: ' + path)
  /** Read the version and stable identity before scanning the workspace. */
  const info = jsonFile(path)
  if (info?.schemaVersion !== 8) throw new Error(`Unsupported workspace schema version ${info?.schemaVersion}. Expected 8: ${path}`)
  if (typeof info.workspaceId !== 'string' || !info.workspaceId || typeof info.workspaceName !== 'string') throw new Error('Invalid workspace metadata: ' + path)
  /** Stage every record before publishing a managed file. */
  const source = emptyContents(info.workspaceId, info.workspaceName)
  /** Only immediate marked directories are workspace projects. */
  const root = dirname(path)
  for (const folder of entries(root)) {
    /** Project metadata is relative to the selected legacy workspace. */
    const projectPath = join(root, folder)
    if (!getFs().existsSync(join(projectPath, PROJECT_INFO_FILENAME))) continue
    /** Validate each project against its previously discovered siblings. */
    const project: Project = { ...prepareProjectInfo(readProjectInfo(projectPath), source.projects), folderName: basename(projectPath), collectionEntries: [] }
    source.projects.push(project)
    for (const kind of ['prompt', 'template'] as const) {
      /** Collections are scoped to their project and library kind. */
      const library = join(projectPath, kind === 'prompt' ? 'Prompts' : 'Templates')
      for (const name of entries(library)) {
        if (!getFs().existsSync(join(library, name, '_CollectionInfo.json'))) continue
        /** Membership records use the original collection ID. */
        const collection = readCollection(source, projectPath, name, kind)
        source.promptCollection.push(collection)
        project.collectionEntries.push(collectionEntryRef(collection.id))
      }
    }
  }
  return publishWorkspace(source)
}
