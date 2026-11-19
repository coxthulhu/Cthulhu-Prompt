import { randomUUID } from 'crypto'
import * as path from 'path'
import { parseMarkdownFrontmatter } from '../Persistence/MarkdownFrontmatter'
import {
  isWorkspaceRootPath,
  resolveWorkspaceInfoPath,
  workspaceRootPathErrorMessage
} from '@shared/domain/workspace/workspacePath'
import { compactGuid } from '@shared/utilities/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { PromptStatus } from '@shared/domain/prompt/Prompt'
import { createFilenameAllocator } from '../Persistence/FilenameAllocation'
import { promptEntryRef, promptTemplateEntryRef } from '@shared/domain/OrderContainer'
import { getFs } from '../fs-provider'
import {
  serializePromptMarkdown,
  serializePromptTemplateMarkdown
} from '../Persistence/PromptFrontmatter'
import example1PromptSource from '../BundledPrompts/Example1.md?raw'
import example2PromptSource from '../BundledPrompts/Example2.md?raw'
import example3PromptSource from '../BundledPrompts/Example3.md?raw'
import exampleBugFixTemplateSource from '../BundledPrompts/ExampleBugFixTemplate.md?raw'
import exampleFeatureTemplateSource from '../BundledPrompts/ExampleFeatureTemplate.md?raw'
import exampleSimpleTemplateSource from '../BundledPrompts/ExampleSimpleTemplate.md?raw'
import {
  PROMPTS_DIRECTORY_NAME,
  TEMPLATES_DIRECTORY_NAME,
  PROMPT_COLLECTION_INFO_FILENAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX,
  CATEGORY_FILENAME_SUFFIX,
  isWorkspaceInfoFilename,
  resolveActivePromptStatusFolderName,
  resolveCategoriesDirectoryPath,
  resolveCategoryPathFromStem,
  resolveContentStatusFolderPaths,
  resolvePromptCollectionCategoryOrderPath,
  resolvePromptDirectoryPath
} from '../Persistence/PromptPersistencePaths'
import { LATEST_WORKSPACE_SCHEMA_VERSION } from '../Persistence/workspace/WorkspaceMigrations'
import { createCollectionViewState, createWorkspaceTab } from '@shared/domain/ui-state/TabSession'
import { createDefaultWorkspaceUiState } from '@shared/domain/ui-state/UiState'
import { writeTabSession } from '../Persistence/sqlite/TabSessionPersistence'

const EXAMPLE_COLLECTION_NAME = 'MyPrompts'
const EXAMPLE_COLLECTION_DISPLAY_NAME = 'My Prompts'
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
// Default on-disk directory name for the template collection created with each workspace.
const DEFAULT_TEMPLATE_COLLECTION_NAME = 'MyTemplates'
// Default display name for the template collection created with each workspace.
const DEFAULT_TEMPLATE_COLLECTION_DISPLAY_NAME = 'My Templates'

type CreateWorkspaceResult = { success: true } | { success: false; error: string }

/** Writes workspace metadata and returns the identity used by its initial tab session. */
const writeWorkspaceInfoFile = (workspacePath: string, workspaceName: string): string => {
  const fs = getFs()
  const workspaceInfoPath = resolveWorkspaceInfoPath(workspacePath, workspaceName)
  /** Shared identity for workspace files and SQLite navigation state. */
  const workspaceId = compactGuid(randomUUID())
  const content = JSON.stringify(
    {
      schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION,
      workspaceId,
      workspaceName
    },
    null,
    2
  )
  fs.writeFileSync(workspaceInfoPath, content, 'utf8')
  return workspaceId
}

const writeMyProjectCollection = (
  workspacePath: string,
  includeExamplePrompts: boolean,
  templateIdByKey: ReadonlyMap<BundledTemplateKey, string>
): string => {
  const fs = getFs()
  const exampleFolderPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME, EXAMPLE_COLLECTION_NAME)
  // Canonical directory that owns active prompts and collection ordering.
  const activeFolderPath = resolvePromptDirectoryPath(
    workspacePath,
    resolveActivePromptStatusFolderName(EXAMPLE_COLLECTION_NAME),
    'prompt'
  )
  const collectionInfoPath = path.join(
    exampleFolderPath,
    PROMPT_COLLECTION_INFO_FILENAME
  )
  const now = getCurrentIsoSecondTimestamp()
  const promptCollectionId = compactGuid(randomUUID())
  const exampleCategories = includeExamplePrompts
    ? BUNDLED_PROMPT_CATEGORY_DISPLAY_NAMES.map((displayName) => ({
        id: compactGuid(randomUUID()),
        displayName,
        shortDescription: null,
        description: null
      }))
    : []
  const categoryIdByDisplayName = new Map(
    exampleCategories.map((category) => [category.displayName, category.id])
  )
  const examplePrompts = includeExamplePrompts
    ? BUNDLED_PROMPT_SOURCES.map(({ source, templateKey }) => {
        // Parsed bundled document that supplies the prompt's title and body.
        const bundledPrompt = parseMarkdownFrontmatter(source)
        const categoryId = categoryIdByDisplayName.get(bundledPrompt.data.category)
        if (!categoryId) {
          throw new Error(`Unknown bundled prompt category: ${bundledPrompt.data.category}`)
        }
        const templateId = templateKey ? templateIdByKey.get(templateKey) : undefined
        if (templateKey && !templateId) {
          throw new Error(`Unknown bundled prompt template: ${templateKey}`)
        }

        return {
          id: compactGuid(randomUUID()),
          title: bundledPrompt.data.title as string,
          fallbackTitle: '',
          createdAt: now,
          modifiedAt: now,
          status: PromptStatus.Todo,
          category: categoryId,
          ...(templateId ? { templates: [{ id: templateId }] } : {}),
          promptText: bundledPrompt.content.replace(/\r?\n$/, '')
        }
      })
    : []
  /** Names reserved across every bundled file written into this collection. */
  const filenames = createFilenameAllocator()

  // Side effect: create every status directory the collection owns, matching collection creation.
  for (const statusFolderPath of resolveContentStatusFolderPaths(workspacePath, EXAMPLE_COLLECTION_NAME, 'prompt')) {
    fs.mkdirSync(statusFolderPath, { recursive: true })
  }
  fs.mkdirSync(resolveCategoriesDirectoryPath(workspacePath, EXAMPLE_COLLECTION_NAME, 'prompt'), {
    recursive: true
  })

  for (const category of exampleCategories) {
    const categoryStem = filenames.allocate(resolveCategoriesDirectoryPath(workspacePath, EXAMPLE_COLLECTION_NAME, 'prompt'), category.displayName, CATEGORY_FILENAME_SUFFIX)
    fs.writeFileSync(
      resolveCategoryPathFromStem(
        workspacePath,
        EXAMPLE_COLLECTION_NAME,
        'prompt',
        categoryStem
      ),
      JSON.stringify(category, null, 2),
      'utf8'
    )
  }

  for (const prompt of examplePrompts) {
    const promptStem = filenames.allocate(activeFolderPath, prompt.title, PROMPT_MARKDOWN_FILENAME_SUFFIX)
    const markdownPath = path.join(
      activeFolderPath,
      `${promptStem}${PROMPT_MARKDOWN_FILENAME_SUFFIX}`
    )

    fs.writeFileSync(markdownPath, serializePromptMarkdown(prompt), 'utf8')
  }

  fs.writeFileSync(
    collectionInfoPath,
    JSON.stringify(
      {
        displayName: EXAMPLE_COLLECTION_DISPLAY_NAME,
        collectionId: promptCollectionId,
        kind: 'prompt'
      },
      null,
      2
    ),
    'utf8'
  )
  // Side effect: initialize the bundled category order and assign each example prompt.
  fs.writeFileSync(
    resolvePromptCollectionCategoryOrderPath(workspacePath, EXAMPLE_COLLECTION_NAME, 'prompt'),
    JSON.stringify(
      {
        categories: [
          { categoryId: null, entries: [] },
          ...exampleCategories.map((category) => ({
            categoryId: category.id,
            entries: examplePrompts
              .filter((prompt) => prompt.category === category.id)
              .map((prompt) => promptEntryRef(prompt.id))
          }))
        ]
      },
      null,
      2
    ),
    'utf8'
  )
  return promptCollectionId
}

/** Creates the default template collection and returns its persisted collection ID. */
type WriteMyTemplatesCollectionResult = {
  collectionId: string
  templateIdByKey: Map<BundledTemplateKey, string>
}

const writeMyTemplatesCollection = (
  workspacePath: string,
  includeExampleTemplates: boolean
): WriteMyTemplatesCollectionResult => {
  // Filesystem used to persist the default template collection.
  const fs = getFs()
  // Directory path for the default template collection.
  const templateCollectionPath = path.join(
    workspacePath,
    TEMPLATES_DIRECTORY_NAME,
    DEFAULT_TEMPLATE_COLLECTION_NAME
  )
  // Unique identity persisted for this newly created template collection.
  const templateCollectionId = compactGuid(randomUUID())
  const now = getCurrentIsoSecondTimestamp()
  const templates = includeExampleTemplates
    ? BUNDLED_TEMPLATE_SOURCES.map(({ key, source }) => {
        const bundledTemplate = parseMarkdownFrontmatter(source)

        return {
          key,
          id: compactGuid(randomUUID()),
          title: bundledTemplate.data.title as string,
          fallbackTitle: '',
          createdAt: now,
          modifiedAt: now,
          templateText: bundledTemplate.content.replace(/\r?\n$/, '')
        }
      })
    : []

  fs.mkdirSync(templateCollectionPath, {
    recursive: true
  })
  fs.mkdirSync(
    resolveCategoriesDirectoryPath(workspacePath, DEFAULT_TEMPLATE_COLLECTION_NAME, 'template'),
    { recursive: true }
  )
  fs.writeFileSync(
    path.join(
      templateCollectionPath,
      PROMPT_COLLECTION_INFO_FILENAME
    ),
    JSON.stringify(
      {
        displayName: DEFAULT_TEMPLATE_COLLECTION_DISPLAY_NAME,
        collectionId: templateCollectionId,
        kind: 'template'
      },
      null,
      2
    ),
    'utf8'
  )

  // Side effect: create template status directories before writing examples and order metadata.
  for (const statusFolderPath of resolveContentStatusFolderPaths(workspacePath, DEFAULT_TEMPLATE_COLLECTION_NAME, 'template')) {
    fs.mkdirSync(statusFolderPath, { recursive: true })
  }

  /** Template names share the same allocation policy as prompts and categories. */
  const filenames = createFilenameAllocator()
  for (const template of templates) {
    const templateStem = filenames.allocate(path.join(templateCollectionPath, 'Active'), template.title, PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX)
    fs.writeFileSync(
      path.join(
        templateCollectionPath,
        'Active',
        `${templateStem}${PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX}`
      ),
      serializePromptTemplateMarkdown(template),
      'utf8'
    )
  }

  // Side effect: initialize template category-view ordering for the template collection.
  fs.writeFileSync(
    resolvePromptCollectionCategoryOrderPath(
      workspacePath,
      DEFAULT_TEMPLATE_COLLECTION_NAME,
      'template'
    ),
    JSON.stringify(
      {
        categories: [
          {
            categoryId: null,
            entries: templates.map((template) => promptTemplateEntryRef(template.id))
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  )

  return {
    collectionId: templateCollectionId,
    templateIdByKey: new Map(templates.map((template) => [template.key, template.id]))
  }
}

const validateNewWorkspacePath = (workspacePath: string): CreateWorkspaceResult | null => {
  if (isWorkspaceRootPath(workspacePath)) {
    return { success: false, error: workspaceRootPathErrorMessage }
  }

  const fs = getFs()
  const promptsPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME)
  const templatesPath = path.join(workspacePath, TEMPLATES_DIRECTORY_NAME)
  const hasWorkspaceInfoFile =
    fs.existsSync(workspacePath) &&
    fs
      .readdirSync(workspacePath)
      .some(isWorkspaceInfoFilename)

  if (hasWorkspaceInfoFile || fs.existsSync(promptsPath) || fs.existsSync(templatesPath)) {
    return { success: false, error: 'Workspace already exists' }
  }

  return null
}

export const createWorkspace = async (
  workspacePath: string,
  workspaceName: string,
  includeExamplePrompts: boolean
): Promise<CreateWorkspaceResult> => {
  try {
    // Special-case command path: this is an imperative workspace bootstrap,
    // not a normal  revision mutation workflow.
    const validationResult = validateNewWorkspacePath(workspacePath)
    if (validationResult) {
      return validationResult
    }

    const fs = getFs()
    // The first project owns the initial collections and optional bundled examples.
    const projectPath = path.join(workspacePath, 'DefaultProject')
    const promptsPath = path.join(projectPath, PROMPTS_DIRECTORY_NAME)
    const templatesPath = path.join(projectPath, TEMPLATES_DIRECTORY_NAME)
    fs.mkdirSync(promptsPath, { recursive: true })
    fs.mkdirSync(templatesPath, { recursive: true })
    /** Newly created workspace owns its initial tabs independently of other workspaces. */
    const workspaceId = writeWorkspaceInfoFile(workspacePath, workspaceName)
    fs.writeFileSync(path.join(projectPath, 'ProjectInfo.json'), JSON.stringify({
      id: compactGuid(randomUUID()), name: 'Default Project', abbreviation: 'DE'
    }, null, 2), 'utf8')

    /** Initial templates supply references for the bundled prompts. */
    const { collectionId: templateCollectionId, templateIdByKey } = writeMyTemplatesCollection(
      projectPath,
      includeExamplePrompts
    )
    /** Initial prompt collection opens before the template collection in the tab strip. */
    const promptCollectionId = writeMyProjectCollection(
      projectPath,
      includeExamplePrompts,
      templateIdByKey
    )

    /** Seed only newly created workspaces; later opens restore the user's saved session. */
    const tabs = [promptCollectionId, templateCollectionId].map((collectionId) => ({
      ...createWorkspaceTab(compactGuid(randomUUID())),
      collectionId,
      view: { ...createCollectionViewState(), contentOwnerId: collectionId }
    }))
    writeTabSession({
      ...createDefaultWorkspaceUiState(workspaceId),
      tabs,
      selectedTabId: tabs[0].id
    })

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
