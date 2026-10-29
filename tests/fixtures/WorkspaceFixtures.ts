import { createDeterministicId } from './FixtureIds'
import { samplePrompts, heightTestPrompts } from './TestData'
import { getPromptDisplayTitle, resolvePromptTitleUpdate } from '@shared/domain/prompt/promptFallbackTitle'
import { allocateFilenameStem } from '@shared/domain/prompt/promptFilename'
import { PROMPT_COLLECTION_SETTINGS_FIELDS, type PromptCollectionSettings } from '@shared/domain/prompt-collection/PromptCollection'
import {
  isFinalPromptStatus,
  PromptStatus,
  type PromptPersisted,
  type PromptTemplateReference
} from '@shared/domain/prompt/Prompt'
import type { PromptCollectionInfoFile } from '../../src/main/Persistence/workspace/WorkspaceDiskTypes'
import {
  serializePromptMarkdown,
  serializePromptTemplateMarkdown
} from '../../src/main/Persistence/PromptFrontmatter'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import { PROMPT_COLLECTION_SETTINGS_TEXT_FILENAMES } from '../../src/main/Persistence/PromptPersistencePaths'
import {
  VIRTUAL_FIND_FIRST_PROMPT_INDEX,
  VIRTUAL_FIND_LAST_PROMPT_INDEX,
  VIRTUAL_FIND_MARKER,
  virtualFindPromptId
} from '../helpers/VirtualFindTestConstants'

const createPromptCollectionInfo = (
  displayName: string,
  collectionId: string,
  kind: 'prompt' | 'template' = 'prompt'
): PromptCollectionInfoFile => {
  return { displayName, collectionId, kind }
}

/** Returns the CategoryOrder path for one prompt or template status folder. */
const getPromptCollectionCategoryOrderPath = (folderPath: string): string =>
  `${folderPath}/_CollectionInfo/CategoryOrder.json`

const collectionOrderFile = (promptCollectionIds: string[]) => ({
  entries: promptCollectionIds.map((id) => ({ kind: 'collection' as const, id }))
})

/** Builds root category groups while preserving configured fixture order. */
const categoryOrderFile = (
  kind: 'prompt' | 'template',
  contents: Array<{
    id: string
    title?: string
    fallbackTitle?: string
    category?: string
  }>
) => {
  /** Stable configured category IDs emitted after Uncategorized. */
  const categoryIds = [
    ...new Set(
      contents.flatMap((content) =>
        content.category === undefined ? [] : [content.category]
      )
    )
  ]
  return {
    categories: [
      {
        categoryId: null,
        entries: contents
          .filter((content) => content.category === undefined)
          .map((content) => ({ kind, id: content.id }))
      },
      ...categoryIds.map((categoryId) => ({
        categoryId,
        entries: contents
          .filter((content) => content.category === categoryId)
          .map((content) => ({ kind, id: content.id }))
      }))
    ]
  }
}

/**
 * Configuration for creating a prompt collection
 */
export interface PromptCollectionConfig {
  folderName: string
  displayName: string
  promptCollectionId?: string
  collectionSettings?: Partial<PromptCollectionSettings>
  prompts?: Array<{
    id: string
    title?: string
    fallbackTitle?: string
    promptText: string
    createdAt?: string
    status?: PromptStatus
    finalizedAt?: string
    templates?: PromptTemplateReference[] | null
    category?: string
  }>
}

/** Template content owned by a fixture collection or category. */
export interface PromptTemplateFixture {
  id: string
  title?: string
  fallbackTitle?: string
  templateText: string
  createdAt?: string
  category?: string
}

/** Category fixture owned directly by a template collection. */
export interface PromptTemplateCategoryConfig {
  categoryName: string
  displayName: string
  categoryId?: string
  description?: string
  templates?: PromptTemplateFixture[]
}

/** prompt-template collection fixture. */
export interface PromptTemplateCollectionConfig {
  folderName: string
  displayName: string
  collectionId?: string
  description?: string
  categories?: PromptTemplateCategoryConfig[]
  templates?: PromptTemplateFixture[]
}

/** Task-prompt input accepted by workspace fixture builders. */
type PromptFixture = NonNullable<PromptCollectionConfig['prompts']>[number]

const addPromptCollectionSettingsFiles = (
  structure: Record<string, string | null>,
  folderPath: string,
  collection: PromptCollectionConfig
): void => {
  for (const field of PROMPT_COLLECTION_SETTINGS_FIELDS) {
    const value = collection.collectionSettings?.[field]
    if (value == null) continue
    structure[`${folderPath}/_CollectionInfo/${PROMPT_COLLECTION_SETTINGS_TEXT_FILENAMES[field]}`] =
      value
  }
}

function createSinglePromptCollectionsFromPromptCollection(
  promptsCollection: Record<string, PromptFixture>
): PromptCollectionConfig[] {
  return Object.values(promptsCollection).map((prompt) => {
    const safeTitle = prompt.title?.trim() ?? ''
    const sanitizedTitle = safeTitle.replace(/[^A-Za-z0-9]/g, '')
    const folderName = sanitizedTitle || prompt.id

    return {
      folderName,
      displayName: safeTitle || prompt.id,
      prompts: [{ ...prompt }]
    }
  })
}

/**
 * Options for workspace creation
 */
export interface WorkspaceOptions {
  settings?: Record<string, any>
}

const DEFAULT_PROMPT_TIMESTAMP = '2023-01-01T00:00:00.000Z'

const normalizePrompts = (prompts: PromptFixture[] | undefined) => {
  const normalized: Array<PromptFixture & { title: string; fallbackTitle: string }> = []

  for (const prompt of prompts ?? []) {
    const title = typeof prompt.title === 'string' ? prompt.title : ''
    const promptTitleFields = resolvePromptTitleUpdate({
      prompts: normalized,
      promptId: prompt.id,
      currentFallbackTitle: prompt.fallbackTitle,
      nextTitle: title
    })

    normalized.push({
      ...prompt,
      ...promptTitleFields,
      createdAt: prompt.createdAt ?? DEFAULT_PROMPT_TIMESTAMP
    })
  }

  return { prompts: normalized, promptCount: normalized.length }
}

const createPromptFiles = (
  folderPath: string,
  prompts: Array<PromptFixture & { title: string; fallbackTitle: string }>
): {
  promptIds: string[]
  promptFiles: Record<string, string>
} => {
  const promptFiles: Record<string, string> = {}
  /** Full filenames reserved while constructing this physical fixture directory. */
  const occupiedNames = new Set<string>()

  for (const prompt of prompts) {
    const promptData: PromptPersisted = {
      id: prompt.id,
      title: prompt.title ?? '',
      fallbackTitle: prompt.fallbackTitle ?? '',
      createdAt: prompt.createdAt ?? DEFAULT_PROMPT_TIMESTAMP,
      modifiedAt: prompt.createdAt ?? DEFAULT_PROMPT_TIMESTAMP,
      status: prompt.status ?? PromptStatus.Todo,
      promptText: prompt.promptText,
      ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
      ...(prompt.category !== undefined ? { category: prompt.category } : {}),
      ...(isFinalPromptStatus(prompt.status ?? PromptStatus.Todo) && prompt.finalizedAt
        ? { finalizedAt: prompt.finalizedAt }
        : {})
    }
    const displayTitle = getPromptDisplayTitle(promptData)
    const promptStem = allocateFilenameStem(displayTitle, '.prompt.md', occupiedNames)

    promptFiles[`${folderPath}/${promptStem}.prompt.md`] = serializePromptMarkdown(promptData)
  }

  return {
    promptIds: prompts.map((prompt) => prompt.id),
    promptFiles
  }
}

/**
 * Complete test scenarios with collections and prompts
 */
const workspaceScenarios = {
  populated: {
    description: 'Workspace with sample prompts for integration testing',
    examplesCollection: {
      folderName: 'Examples',
      displayName: 'Example Prompts',
      prompts: [samplePrompts.simple]
    },
    developmentCollection: {
      folderName: 'Development',
      displayName: 'Development Tools',
      prompts: [
        {
          id: 'dev-1',
          title: 'Code Review',
          promptText: 'Please review this code for best practices',
          createdAt: '2023-01-02T12:00:00.000Z'
        },
        {
          id: 'dev-2',
          title: 'Bug Analysis',
          promptText: 'Analyze this bug and suggest fixes',
          createdAt: '2023-01-03T12:00:00.000Z'
        }
      ]
    }
  }
}

/**
 * Predefined workspace scenarios for common test cases
 */
export type WorkspaceScenario =
  | 'empty' // Truly empty (just directory)
  | 'minimal' // Basic workspace structure with settings
  | 'sample' // Workspace with Examples and Development prompt collections
  | 'height' // Workspace with collections for height tests
  | 'categories' // Workspace with a prompt collection containing one category
  | 'categories-ui' // Dedicated category screen rendering fixture
  | 'categories-controls' // Dedicated category two-prompt movement-control fixture
  | 'categories-single-level' // Dedicated single-level category fixture
  | 'virtual' // Workspace with collections for virtualization/overscan tests
  | 'long-wrapped-lines' // Workspace with wrapped prompts that overflow default estimations
  | 'virtual-placeholder' // Workspace with prompts tailored for placeholder hydration tests

export const DEFAULT_WORKSPACES: Record<
  Exclude<WorkspaceScenario, 'empty' | 'minimal'> | 'empty' | 'minimal',
  string
> = {
  empty: '/ws/empty',
  minimal: '/ws/minimal',
  sample: '/ws/sample',
  height: '/ws/height',
  categories: '/ws/categories',
  'categories-ui': '/ws/categories-ui',
  'categories-controls': '/ws/categories-controls',
  'categories-single-level': '/ws/categories-single-level',
  virtual: '/ws/virtual',
  'long-wrapped-lines': '/ws/long-wrapped-lines',
  'virtual-placeholder': '/ws/virtual-placeholder'
}

export function getWorkspacePath(scenario: WorkspaceScenario): string {
  return DEFAULT_WORKSPACES[scenario]
}

export function getWorkspaceInfoPath(workspacePath: string): string {
  const segments = workspacePath.split(/[\\/]+/).filter(Boolean)
  const workspaceName = segments[segments.length - 1] ?? 'Workspace'
  return `${workspacePath}/${workspaceName}.cthulhuprompt`
}

/**
 * Creates a basic workspace with minimal required structure
 *
 * @param workspacePath - The path where the workspace should be created
 * @param options - Optional configuration for the workspace
 * @returns The filesystem structure object
 */
export function createBasicWorkspace(
  workspacePath: string,
  options: WorkspaceOptions = {}
): Record<string, string | null> {
  const { settings = {} } = options
  const workspaceId =
    typeof settings.workspaceId === 'string'
      ? settings.workspaceId
      : createDeterministicId(workspacePath)
  const settingsPayload = { schemaVersion: 5, ...settings, workspaceId }
  const workspaceName =
    typeof settings.workspaceName === 'string'
      ? settings.workspaceName
      : getWorkspaceInfoPath(workspacePath)
          .split('/')
          .pop()!
          .replace(/\.cthulhuprompt$/, '')

  const structure: Record<string, string | null> = {
    [`${workspacePath}/Prompts`]: null,
    [`${workspacePath}/Templates`]: null,
    [`${workspacePath}/Prompts/CollectionOrder.json`]: JSON.stringify(collectionOrderFile([]), null, 2),
    [`${workspacePath}/Templates/CollectionOrder.json`]: JSON.stringify(collectionOrderFile([]), null, 2),
    [getWorkspaceInfoPath(workspacePath)]: JSON.stringify(
      { ...settingsPayload, workspaceName },
      null,
      2
    )
  }

  return structure
}

/**
 * Creates a workspace with specified prompt collections
 *
 * @param workspacePath - The path where the workspace should be created
 * @param collectionConfigs - Array of collection configurations to create
 * @param workspaceOptions - Optional workspace configuration
 * @returns The filesystem structure object
 */
export function createWorkspaceWithCollections(
  workspacePath: string,
  collectionConfigs: PromptCollectionConfig[],
  workspaceOptions: WorkspaceOptions = {}
): Record<string, string | null> {
  // First create basic workspace
  const structure = createBasicWorkspace(workspacePath, workspaceOptions)
  const promptCollectionIds: string[] = []

  // Add each collection
  for (const collection of collectionConfigs) {
    /** Root identity matches the metadata generated by the shared collection builder. */
    const promptCollectionId =
      typeof collection.promptCollectionId === 'string'
        ? collection.promptCollectionId
        : createDeterministicId(`${workspacePath}:${collection.folderName}`)
    promptCollectionIds.push(promptCollectionId)
    Object.assign(structure, addCollectionToWorkspace(workspacePath, collection))
  }
  structure[`${workspacePath}/Prompts/CollectionOrder.json`] = JSON.stringify(
    collectionOrderFile(promptCollectionIds),
    null,
    2
  )

  return typeof workspaceOptions.settings?.schemaVersion === 'number' && workspaceOptions.settings.schemaVersion < 5
    ? createLegacyWorkspaceFilesystem(structure, workspaceOptions.settings.schemaVersion)
    : structure
}

/** Converts current fixture metadata into the exact folder-era format for migration tests. */
export function createLegacyWorkspaceFilesystem(
  filesystem: Record<string, string | null>,
  schemaVersion: number
): Record<string, string | null> {
  return Object.fromEntries(Object.entries(filesystem).map(([filePath, content]) => {
    /** Historical metadata path; prompt, template, category, and description bytes are unchanged. */
    const legacyPath = filePath.replaceAll('_CollectionInfo', '_FolderInfo')
      .replaceAll('CollectionInfo.json', 'FolderInfo.json')
      .replaceAll('CategoryOrder.json', 'FolderOrder.json')
      .replaceAll('CollectionOrder.json', 'FolderOrder.json')
    if (content === null) return [legacyPath, content]
    if (filePath.endsWith('.cthulhuprompt')) {
      return [legacyPath, JSON.stringify({ ...JSON.parse(content), schemaVersion }, null, 2)]
    }
    if (filePath.endsWith('/CollectionInfo.json')) {
      /** Root metadata retains its stable identity under the old field name. */
      const { collectionId, ...info } = JSON.parse(content)
      return [legacyPath, JSON.stringify({ ...info, folderId: collectionId }, null, 2)]
    }
    if (filePath.endsWith('CollectionOrder.json')) {
      /** Root entries use the discriminator understood by the historical migrations. */
      const order = JSON.parse(content)
      return [legacyPath, JSON.stringify({ ...order, entries: order.entries.map((entry: { id: string }) => ({ ...entry, kind: 'folder' })) }, null, 2)]
    }
    return [legacyPath, content]
  }))
}

export function createWorkspaceWithTemplateCollections(
  workspacePath: string,
  collectionConfigs: PromptTemplateCollectionConfig[]
): Record<string, string | null> {
  const structure = createBasicWorkspace(workspacePath)
  /** Creates one flat template root with direct category fixtures. */
  const addCollection = (collection: PromptTemplateCollectionConfig): string => {
    const folderPath = `${workspacePath}/Templates/${collection.folderName}`
    const collectionId =
      collection.collectionId ?? createDeterministicId(`${workspacePath}:template:${folderPath}`)
    /** Root-owned templates that remain Uncategorized. */
    const rootTemplates = collection.templates ?? []
    /** Category fixtures owned by this template root. */
    const categoryFixtures = (collection.categories ?? []).map((category) => ({
      categoryId:
        category.categoryId ??
        createDeterministicId(`${workspacePath}:template:${folderPath}/${category.categoryName}`),
      displayName: category.displayName,
      description: category.description ?? null,
      templates: category.templates ?? []
    }))

    structure[`${folderPath}/_CollectionInfo/CollectionInfo.json`] = JSON.stringify(
      createPromptCollectionInfo(collection.displayName, collectionId, 'template'),
      null,
      2
    )
    if (collection.description !== undefined) {
      structure[`${folderPath}/_CollectionInfo/Description.md`] = collection.description
    }
    structure[`${folderPath}/Categories`] = null
    for (const categoryFixture of categoryFixtures) {
      structure[
        `${folderPath}/Categories/${categoryFixture.displayName}.category.json`
      ] = JSON.stringify(
        {
          id: categoryFixture.categoryId,
          displayName: categoryFixture.displayName,
          shortDescription: null,
          description: categoryFixture.description
        },
        null,
        2
      )
    }
    /** Flattened templates carry category front matter matching their first-layer owner. */
    const templates = [
      ...rootTemplates,
      ...categoryFixtures.flatMap((categoryFixture) =>
        categoryFixture.templates.map((template) => ({
          ...template,
          category: categoryFixture.categoryId
        }))
      )
    ]
    structure[getPromptCollectionCategoryOrderPath(`${folderPath}/Active`)] = JSON.stringify(
      {
        categories: [
          {
            categoryId: null,
            entries: rootTemplates.map((template) => ({ kind: 'template', id: template.id }))
          },
          ...categoryFixtures.map((categoryFixture) => ({
            categoryId: categoryFixture.categoryId,
            entries: categoryFixture.templates.map((template) => ({
              kind: 'template',
              id: template.id
            }))
          }))
        ]
      },
      null,
      2
    )

    /** Template fixtures must retain every duplicate-title record. */
    const occupiedNames = new Set<string>()
    for (const template of templates) {
      const title = template.title ?? ''
      const fallbackTitle = template.fallbackTitle ?? ''
      const templateData: PromptTemplatePersisted = {
        id: template.id,
        title,
        fallbackTitle,
        createdAt: template.createdAt ?? DEFAULT_PROMPT_TIMESTAMP,
        modifiedAt: template.createdAt ?? DEFAULT_PROMPT_TIMESTAMP,
        templateText: template.templateText,
        ...(template.category !== undefined ? { category: template.category } : {})
      }
      const displayTitle = getPromptDisplayTitle(templateData)
      structure[`${folderPath}/Active/${allocateFilenameStem(displayTitle, '.template.md', occupiedNames)}.template.md`] =
        serializePromptTemplateMarkdown(templateData)
    }

    return collectionId
  }

  const collectionIds = collectionConfigs.map(addCollection)

  structure[`${workspacePath}/Templates/CollectionOrder.json`] = JSON.stringify(
    collectionOrderFile(collectionIds),
    null,
    2
  )
  return structure
}

/**
 * Creates a workspace using a predefined scenario
 *
 * @param workspacePath - The path where the workspace should be created
 * @param scenario - The predefined scenario to use
 * @returns The filesystem structure object
 */
export function setupWorkspaceScenario(
  workspacePath: string,
  scenario: WorkspaceScenario
): Record<string, string | null> {
  switch (scenario) {
    case 'empty':
      return { [`${workspacePath}`]: null }

    case 'minimal':
      return createBasicWorkspace(workspacePath)

    case 'sample':
      return createWorkspaceWithCollections(workspacePath, [
        { ...workspaceScenarios.populated.examplesCollection },
        { ...workspaceScenarios.populated.developmentCollection }
      ])

    case 'height': {
      const heightPromptCollections = createSinglePromptCollectionsFromPromptCollection(heightTestPrompts)
      return createWorkspaceWithCollections(workspacePath, heightPromptCollections)
    }

    case 'categories': {
      /** Category fixture owned directly by the Main collection. */
      const categoryId = createDeterministicId(`${workspacePath}:Main/Category`)
      const structure = createWorkspaceWithCollections(workspacePath, [
        {
          folderName: 'Main',
          displayName: 'Main',
          prompts: [
            {
              id: 'base-before',
              title: 'Base Before',
              promptText: 'Visible base prompt before the category.'
            },
            {
              id: 'base-after',
              title: 'Base After',
              promptText: 'Visible base prompt after the category.'
            },
            {
              id: 'category-prompt',
              title: 'Category Prompt',
              promptText: 'Prompt text from a categorized prompt.',
              category: categoryId
            }
          ]
        }
      ])
      structure[`${workspacePath}/Prompts/Main/Categories/Category.category.json`] = JSON.stringify(
        { id: categoryId, displayName: 'Category', shortDescription: null, description: '' },
        null,
        2
      )

      return structure
    }

    case 'categories-ui': {
      /** Category IDs provide deterministic identities for category UI tests. */
      const primaryCategoryId = createDeterministicId(`${workspacePath}:Hierarchy/Primary`)
      const emptyCategoryId = createDeterministicId(`${workspacePath}:Hierarchy/Empty`)
      const structure = createWorkspaceWithCollections(workspacePath, [
        {
          folderName: 'Hierarchy',
          displayName: 'Hierarchy',
          collectionSettings: {
            collectionDescription: 'Root hierarchy collection description.'
          },
          prompts: [
            {
              id: 'categories-ui-root-before',
              title: 'Root Before',
              promptText: 'Root prompt before the categories.'
            },
            {
              id: 'categories-ui-root-after',
              title: 'Root After',
              promptText: 'Root prompt after the categories.'
            },
            {
              id: 'categories-ui-category-prompt',
              title: 'Category Prompt',
              promptText: 'Prompt text inside the category.',
              category: primaryCategoryId
            },
            {
              id: 'categories-ui-second-category-prompt',
              title: 'Second Category Prompt',
              promptText: 'Second prompt inside the category.',
              category: primaryCategoryId
            },
            {
              id: 'categories-ui-root-completed',
              title: 'Root Completed',
              promptText: 'Completed prompt directly inside the collection.',
              status: PromptStatus.Completed,
              finalizedAt: '2026-07-09T10:00:00.000Z'
            },
            {
              id: 'categories-ui-category-completed-1',
              title: 'Category Completed One',
              promptText: 'First completed prompt owned by the category.',
              status: PromptStatus.Completed,
              finalizedAt: '2026-07-09T11:00:00.000Z',
              category: primaryCategoryId
            },
            {
              id: 'categories-ui-category-completed-2',
              title: 'Category Completed Two',
              promptText: 'Second completed prompt owned by the category.',
              status: PromptStatus.Completed,
              finalizedAt: '2026-07-09T12:00:00.000Z',
              category: primaryCategoryId
            }
          ]
        },
        { folderName: 'EmptyRoot', displayName: 'Empty Root' }
      ])
      structure[`${workspacePath}/Prompts/Hierarchy/Categories/Primary.category.json`] =
        JSON.stringify(
          {
            id: primaryCategoryId,
            displayName: 'Primary',
            shortDescription: null,
            description: 'Primary category description.'
          },
          null,
          2
        )
      structure[`${workspacePath}/Prompts/Hierarchy/Categories/Empty.category.json`] =
        JSON.stringify(
          { id: emptyCategoryId, displayName: 'Empty', shortDescription: null, description: null },
          null,
          2
        )
      structure[getPromptCollectionCategoryOrderPath(`${workspacePath}/Prompts/Hierarchy/Active`)] =
        JSON.stringify(
          {
            categories: [
              {
                categoryId: null,
                entries: [
                  { kind: 'prompt', id: 'categories-ui-root-before' },
                  { kind: 'prompt', id: 'categories-ui-root-after' }
                ]
              },
              {
                categoryId: primaryCategoryId,
                entries: [
                  { kind: 'prompt', id: 'categories-ui-category-prompt' },
                  { kind: 'prompt', id: 'categories-ui-second-category-prompt' }
                ]
              },
              { categoryId: emptyCategoryId, entries: [] }
            ]
          },
          null,
          2
        )

      return structure
    }

    case 'categories-single-level': {
      const rootName = 'CategoryRoot'
      /** Single supported category used to verify the flat category model. */
      const categoryId = createDeterministicId(`${workspacePath}:${rootName}/Category`)
      const structure = createWorkspaceWithCollections(workspacePath, [
        { folderName: rootName, displayName: 'Category Root' }
      ])
      structure[`${workspacePath}/Prompts/${rootName}/Categories/Category.category.json`] =
        JSON.stringify(
          { id: categoryId, displayName: 'Category', shortDescription: null, description: null },
          null,
          2
        )
      structure[getPromptCollectionCategoryOrderPath(`${workspacePath}/Prompts/${rootName}/Active`)] =
        JSON.stringify(
          {
            categories: [
              { categoryId: null, entries: [] },
              { categoryId, entries: [] }
            ]
          },
          null,
          2
        )

      return structure
    }

    case 'categories-controls': {
      /** Two categories used by the prompt movement fixture. */
      const primaryCategoryId = createDeterministicId(`${workspacePath}:Controls/Primary`)
      const secondaryCategoryId = createDeterministicId(`${workspacePath}:Controls/Secondary`)
      const structure = createWorkspaceWithCollections(workspacePath, [
        {
          folderName: 'Controls',
          displayName: 'Controls',
          prompts: [
            {
              id: 'categories-controls-first',
              title: 'First Category Prompt',
              promptText: 'First categorized prompt for movement controls.',
              category: primaryCategoryId
            },
            {
              id: 'categories-controls-second',
              title: 'Second Category Prompt',
              promptText: 'Second categorized prompt for movement controls.',
              category: primaryCategoryId
            }
          ]
        }
      ])
      structure[`${workspacePath}/Prompts/Controls/Categories/Primary.category.json`] =
        JSON.stringify(
          { id: primaryCategoryId, displayName: 'Primary', shortDescription: null, description: null },
          null,
          2
        )
      structure[`${workspacePath}/Prompts/Controls/Categories/Secondary.category.json`] =
        JSON.stringify(
          { id: secondaryCategoryId, displayName: 'Secondary', shortDescription: null, description: null },
          null,
          2
        )
      structure[getPromptCollectionCategoryOrderPath(`${workspacePath}/Prompts/Controls/Active`)] =
        JSON.stringify(
          {
            categories: [
              { categoryId: null, entries: [] },
              {
                categoryId: primaryCategoryId,
                entries: [
                  { kind: 'prompt', id: 'categories-controls-first' },
                  { kind: 'prompt', id: 'categories-controls-second' }
                ]
              },
              { categoryId: secondaryCategoryId, entries: [] }
            ]
          },
          null,
          2
        )

      return structure
    }

    case 'virtual': {
      // Short: many small prompts for overscan
      const shortPrompts = Array.from({ length: 60 }, (_, i) => ({
        id: `short-${i + 1}`,
        title: `Short ${i + 1}`,
        promptText: 'one line'
      }))

      // Empty: many empty prompts for Monaco autoscroll tests
      const emptyPrompts = Array.from({ length: 80 }, (_, i) => ({
        id: `empty-${i + 1}`,
        title: `Empty ${i + 1}`,
        promptText: ''
      }))

      // Mixed: small + medium + large examples
      const mixedPrompts = [
        heightTestPrompts.singleLine,
        heightTestPrompts.threeLine,
        heightTestPrompts.tenLine,
        heightTestPrompts.twentyFiveLine,
        heightTestPrompts.fiftyLine
      ]

      // Long: many large prompts; keep IDs to match existing tests
      const longPrompts = Array.from({ length: 50 }, (_, i) => {
        const base = heightTestPrompts.twoHundredLine
        const uniquePrefix =
          i === VIRTUAL_FIND_FIRST_PROMPT_INDEX - 1 ? `${VIRTUAL_FIND_MARKER}\n` : ''
        const uniqueSuffix =
          i === VIRTUAL_FIND_LAST_PROMPT_INDEX - 1 ? `\n${VIRTUAL_FIND_MARKER}` : ''
        return {
          ...base,
          id: virtualFindPromptId(i + 1),
          title: `Large Prompt ${i + 1}`,
          promptText: `${uniquePrefix}${base.promptText}${uniqueSuffix}`
        }
      })

      // Long Mixed: 100 prompts with varying lengths to stress virtualization
      const longMixedTemplates = [
        heightTestPrompts.singleLine,
        heightTestPrompts.threeLine,
        heightTestPrompts.tenLine,
        heightTestPrompts.twentyFiveLine,
        heightTestPrompts.fiftyLine,
        heightTestPrompts.hundredLine,
        heightTestPrompts.twoHundredLine
      ]
      const longMixedPrompts = Array.from({ length: 100 }, (_, i) => {
        const base = longMixedTemplates[i % longMixedTemplates.length]
        return {
          id: `longmixed-${i + 1}`,
          title: `Long Mixed ${i + 1}`,
          promptText: base.promptText,
          createdAt: base.createdAt
        }
      })

      return createWorkspaceWithCollections(workspacePath, [
        { folderName: 'Short', displayName: 'Short', prompts: shortPrompts },
        { folderName: 'Empty', displayName: 'Empty', prompts: emptyPrompts },
        { folderName: 'Mixed', displayName: 'Mixed', prompts: mixedPrompts },
        { folderName: 'Long', displayName: 'Long', prompts: longPrompts },
        { folderName: 'LongMixed', displayName: 'Long Mixed', prompts: longMixedPrompts }
      ])
    }

    case 'virtual-placeholder': {
      const twentyLineBase = heightTestPrompts.twentyLine
      const placeholderPrompts = Array.from({ length: 100 }, (_, index) => ({
        id: `placeholder-${index + 1}`,
        title: `Placeholder Prompt ${index + 1}`,
        promptText: twentyLineBase.promptText,
        createdAt: twentyLineBase.createdAt
      }))

      return createWorkspaceWithCollections(workspacePath, [
        {
          folderName: 'PlaceholderHeight',
          displayName: 'Placeholder Height',
          prompts: placeholderPrompts
        }
      ])
    }

    case 'long-wrapped-lines': {
      const base = heightTestPrompts.longWrappedSingleLineOverflow
      const measurementPrompts = Array.from({ length: 80 }, (_, index) => ({
        id: `measurement-${index + 1}`,
        title: `Measurement Prompt ${index + 1}`,
        promptText: base.promptText,
        createdAt: base.createdAt
      }))

      return createWorkspaceWithCollections(workspacePath, [
        {
          folderName: 'LongWrappedSingles',
          displayName: 'Long Wrapped Singles',
          prompts: measurementPrompts
        }
      ])
    }

    default:
      throw new Error(`Unknown workspace scenario: ${scenario}`)
  }
}

/**
 * Adds a single collection to an existing workspace
 *
 * @param workspacePath - The path to the existing workspace
 * @param collectionConfig - Configuration for the collection to add
 * @returns The filesystem structure for the new collection
 */
export function addCollectionToWorkspace(
  workspacePath: string,
  collectionConfig: PromptCollectionConfig
): Record<string, string | null> {
  const folderPath = `${workspacePath}/Prompts/${collectionConfig.folderName}`
  // Canonical root directory that owns active prompt files and ordering.
  const activeFolderPath = `${folderPath}/Active`
  const { prompts } = normalizePrompts(collectionConfig.prompts)
  // Active fixture prompts remain in the hierarchy and its authoritative order.
  const activePrompts = prompts.filter(
    (prompt) => !isFinalPromptStatus(prompt.status ?? PromptStatus.Todo)
  )
  // Completed fixture prompts share the root's flat completed directory.
  const completedPrompts = prompts.filter((prompt) => prompt.status === PromptStatus.Completed)
  // Archived fixture prompts share the added root's flat archived directory.
  const archivedPrompts = prompts.filter((prompt) => prompt.status === PromptStatus.Archived)
  const { promptFiles } = createPromptFiles(activeFolderPath, activePrompts)
  const { promptFiles: completedPromptFiles } = createPromptFiles(
    `${folderPath}/Completed`,
    completedPrompts
  )
  // Serialized archived files mirror full-workspace fixture creation.
  const { promptFiles: archivedPromptFiles } = createPromptFiles(
    `${folderPath}/Archived`,
    archivedPrompts
  )
  const promptCollectionId =
    typeof collectionConfig.promptCollectionId === 'string'
      ? collectionConfig.promptCollectionId
      : createDeterministicId(`${workspacePath}:${collectionConfig.folderName}`)

  const structure: Record<string, string | null> = {
    [getPromptCollectionCategoryOrderPath(activeFolderPath)]: JSON.stringify(
      categoryOrderFile('prompt', activePrompts),
      null,
      2
    ),
    [`${folderPath}/_CollectionInfo/CollectionInfo.json`]: JSON.stringify(
      createPromptCollectionInfo(collectionConfig.displayName, promptCollectionId),
      null,
      2
    ),
    [`${folderPath}/Completed`]: null,
    [`${folderPath}/Archived`]: null,
    [`${folderPath}/Categories`]: null,
    ...promptFiles,
    ...completedPromptFiles,
    ...archivedPromptFiles
  }
  addPromptCollectionSettingsFiles(structure, folderPath, collectionConfig)

  return structure
}

/**
 * Quick helpers for creating common test data patterns
 */
export const testHelpers = {
  /**
   * Creates a workspace with sample prompts using predefined data
   */
  createWorkspaceWithSamplePrompts(
    workspacePath: string,
    folderName: string = 'TestCollection'
  ): Record<string, string | null> {
    return createWorkspaceWithCollections(workspacePath, [
      {
        folderName,
        displayName: folderName.replace(/([A-Z])/g, ' $1').trim(),
        prompts: [samplePrompts.simple, samplePrompts.complex]
      }
    ])
  },

  /**
   * Creates a minimal workspace setup for basic testing
   */
  createMinimalWorkspace(workspacePath: string): Record<string, string | null> {
    return setupWorkspaceScenario(workspacePath, 'minimal')
  },

  /**
   * Creates workspace with specific prompt content for testing
   */
  createWorkspaceWithPrompt(
    workspacePath: string,
    folderName: string,
    promptData: any
  ): Record<string, string | null> {
    return createWorkspaceWithCollections(workspacePath, [
      {
        folderName,
        displayName: folderName,
        prompts: [promptData]
      }
    ])
  }
}

/**
 * Creates a workspace used for virtualization stress tests.
 * Generates a collection with many large prompts (e.g., 50 two-hundred-line prompts).
 */
export function createVirtualizationTestWorkspace(
  workspacePath: string,
  count: number = 50
): Record<string, string | null> {
  const manyLargePrompts = Array.from({ length: count }, (_, i) => ({
    ...heightTestPrompts.twoHundredLine,
    id: `virtualization-test-${i + 1}`,
    title: `Large Prompt ${i + 1}`
  }))

  return createWorkspaceWithCollections(workspacePath, [
    {
      folderName: 'Examples',
      displayName: 'Example Prompts',
      prompts: manyLargePrompts
    }
  ])
}

/**
 * Creates a workspace with prompts but no collection structure (for testing edge cases)
 *
 * @param workspacePath - The path where the workspace should be created
 */
export function createInvalidWorkspace(workspacePath: string): Record<string, string | null> {
  return {
    [`${workspacePath}/some-file.txt`]: 'Not a valid workspace'
  }
}

/**
 * Creates a corrupted workspace for error testing
 *
 * @param workspacePath - The path where the workspace should be created
 * @param corruptionType - The type of corruption to introduce
 */
export function createCorruptedWorkspace(
  workspacePath: string,
  corruptionType: 'missing-settings' | 'invalid-json' | 'missing-prompts'
): Record<string, string | null> {
  const structure: Record<string, string | null> = {}

  switch (corruptionType) {
    case 'missing-settings':
      structure[`${workspacePath}/Prompts`] = null
      // Missing .cthulhuprompt
      break

    case 'invalid-json':
      structure[`${workspacePath}/Prompts`] = null
      structure[getWorkspaceInfoPath(workspacePath)] = '{ invalid json'
      break

    case 'missing-prompts':
      structure[getWorkspaceInfoPath(workspacePath)] = JSON.stringify(
        {
          schemaVersion: 5,
          workspaceId: createDeterministicId(workspacePath),
          workspaceName: getWorkspaceInfoPath(workspacePath)
            .split('/')
            .pop()!
            .replace(/\.cthulhuprompt$/, '')
        },
        null,
        2
      )
      // Missing prompts directory
      break
  }

  return structure
}
