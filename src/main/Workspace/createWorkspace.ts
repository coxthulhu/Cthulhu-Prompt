import { rmSync } from 'node:fs'
import { collectionEntryRef } from '@shared/domain/OrderContainer'
import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { createStarterCollection, STARTER_COLLECTION_KINDS } from '@shared/domain/prompt-collection/PromptCollection'
import { emptyContents, listWorkspacePaths, publishWorkspace, saveWorkspaceOrder } from '../Persistence/sqlite/WorkspaceDatabase'
import { UserPersistenceDataAccess } from '../Persistence/sqlite/UserPersistenceDataAccess'
import type { UserPersistence } from '@shared/domain/user-persistence/UserPersistence'
import { SqliteDataAccess } from '../Persistence/sqlite/SqliteDataAccess'
import { randomUUID } from 'crypto'
import { parseMarkdownFrontmatter } from '../Persistence/MarkdownFrontmatter'
import { compactGuid } from '@shared/utilities/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { PromptStatus } from '@shared/domain/prompt/Prompt'
import { promptEntryRef, promptTemplateEntryRef } from '@shared/domain/OrderContainer'
import changelogRoutineSource from '../BundledPrompts/UpdateChangelog.md?raw'
import example1PromptSource from '../BundledPrompts/Example1.md?raw'
import example2PromptSource from '../BundledPrompts/Example2.md?raw'
import example3PromptSource from '../BundledPrompts/Example3.md?raw'
import exampleBugFixTemplateSource from '../BundledPrompts/ExampleBugFixTemplate.md?raw'
import exampleFeatureTemplateSource from '../BundledPrompts/ExampleFeatureTemplate.md?raw'
import exampleSimpleTemplateSource from '../BundledPrompts/ExampleSimpleTemplate.md?raw'
import { createCollectionViewState, createWorkspaceTab } from '@shared/domain/ui-state/TabSession'
import { createDefaultWorkspaceUiState } from '@shared/domain/ui-state/UiState'
import { writeTabSession } from '../Persistence/sqlite/TabSessionPersistence'

// Ordered categories created with the bundled example prompts.
const BUNDLED_PROMPT_CATEGORY_DISPLAY_NAMES = [
  'Features & Improvements',
  'Bug Fixes'
] as const
type BundledTemplateKey = 'feature' | 'bugFix' | 'simple'
// Ordered bundled prompt sources used when initializing a workspace with examples.
const BUNDLED_PROMPT_SOURCES: Array<{
  source: string
  templateKey?: BundledTemplateKey
}> = [
  { source: example1PromptSource },
  { source: example2PromptSource, templateKey: 'feature' },
  { source: example3PromptSource, templateKey: 'bugFix' }
]
// Ordered bundled template sources used when initializing a workspace with examples.
const BUNDLED_TEMPLATE_SOURCES: Array<{
  key: BundledTemplateKey
  source: string
}> = [
  { key: 'simple', source: exampleSimpleTemplateSource },
  { key: 'feature', source: exampleFeatureTemplateSource },
  { key: 'bugFix', source: exampleBugFixTemplateSource }
]

/** Allocates a domain identity shared by workspace content and local session state. */
const newId = (): string => compactGuid(randomUUID())

/** Seeds the project's starter collections, optional examples, and initial work tabs. */
export const createWorkspace = (workspaceName: string, examples: boolean, firstLaunch?: UserPersistence) => {
  /** Build the initial shared records together before publishing the file. */
  const source = emptyContents(newId(), workspaceName)
  /** Give all bundled content the same creation and modification time. */
  const now = getCurrentIsoSecondTimestamp()
  /** Starter libraries and tabs use the same order. */
  const collections = STARTER_COLLECTION_KINDS.map((kind) => createStarterCollection(newId(), kind))
  /** Each library receives its own example content. */
  const [prompts, templates, routines] = collections
  source.promptCollection = collections
  source.projects.push({ id: newId(), name: 'Default Project', abbreviation: 'DE', folderName: 'DefaultProject',
    collectionEntries: collections.map((collection) => collectionEntryRef(collection.id)) })
  if (examples) {
    /** The bundled routine can be copied immediately without picking a template. */
    const changelog = parseMarkdownFrontmatter(changelogRoutineSource)
    /** The prompt record and its position share this identity. */
    const routineId = newId()
    source.prompt.push({ id: routineId, title: changelog.data.title, fallbackTitle: '', promptText: changelog.content.trimEnd(),
      templates: null, status: PromptTemplateStatus.Active, createdAt: now, modifiedAt: now })
    routines.statusFolders.active.categoryOrder.categories[0].entries.push(promptEntryRef(routineId))
    /** Resolve bundled template keys to this workspace’s newly allocated IDs. */
    const templateIds = new Map<BundledTemplateKey, string>()
    for (const bundled of BUNDLED_TEMPLATE_SOURCES) {
      /** Read the packaged example’s front matter and editor text. */
      const { data, content } = parseMarkdownFrontmatter(bundled.source)
      /** Stable identity used by the new template and its prompt references. */
      const id = newId()
      templateIds.set(bundled.key, id)
      source.promptTemplate.push({ id, title: data.title, fallbackTitle: '', templateText: content.replace(/\r?\n$/, ''),
        status: PromptTemplateStatus.Active, createdAt: now, modifiedAt: now })
      templates.statusFolders.active.categoryOrder.categories[0].entries.push(promptTemplateEntryRef(id))
    }
    for (const displayName of BUNDLED_PROMPT_CATEGORY_DISPLAY_NAMES) {
      /** Each example category is shared by Active and Backlog. */
      const id = newId()
      source.category.push({ id, displayName, shortDescription: null, description: null })
      for (const layout of [prompts.statusFolders.active, prompts.statusFolders.backlog]) {
        layout.categoryOrder.categories.push({ categoryId: id, entries: [] })
      }
    }
    for (const bundled of BUNDLED_PROMPT_SOURCES) {
      /** Read the packaged example’s front matter and editor text. */
      const { data, content } = parseMarkdownFrontmatter(bundled.source)
      /** Match the bundled category label to its new record. */
      const category = source.category.find((item) => item.displayName === data.category)!.id
      /** The prompt and its collection ordering entry share this ID. */
      const id = newId()
      source.prompt.push({ id, title: data.title, fallbackTitle: '', promptText: content.replace(/\r?\n$/, ''),
        category, status: PromptStatus.Todo, createdAt: now, modifiedAt: now,
        ...(bundled.templateKey ? { templates: [{ id: templateIds.get(bundled.templateKey)! }] } : {}) })
      prompts.statusFolders.active.categoryOrder.categories.find((group) => group.categoryId === category)!.entries.push(promptEntryRef(id))
    }
  }
  /** The initial tabs are private session state in the main database. */
  const tabs = collections.map(({ id }) => ({ ...createWorkspaceTab(newId()), collectionId: id,
    view: { ...createCollectionViewState(), contentOwnerId: id } }))
  /** Only initialize the session once the workspace can be opened. */
  const path = publishWorkspace(source)
  try {
    SqliteDataAccess.runTransaction(() => {
      saveWorkspaceOrder(source)
      writeTabSession({ ...createDefaultWorkspaceUiState(source.id), tabs, selectedTabId: tabs[0].id })
      if (firstLaunch) UserPersistenceDataAccess.updateUserPersistence({ ...firstLaunch, lastWorkspaceInfoPath: path })
    })
    return { success: true as const, path }
  } catch (error) {
    rmSync(path)
    throw error
  }
}

/** Seeds a fresh profile before the renderer restores its remembered workspace and tabs. */
export const createDefaultWorkspaceOnFirstLaunch = (): void => {
  /** A returning user may have explicitly closed their last workspace. */
  const preferences = UserPersistenceDataAccess.readUserPersistence()
  if (!preferences.hasShownWelcome && !preferences.lastWorkspaceInfoPath && listWorkspacePaths().length === 0) {
    createWorkspace('Default Workspace', true, preferences)
  }
}
