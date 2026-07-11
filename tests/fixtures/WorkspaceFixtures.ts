import { samplePrompts, heightTestPrompts } from './TestData'
import { getPromptDisplayTitle, resolvePromptTitleUpdate } from '@shared/promptFallbackTitle'
import { buildPromptStem, sanitizePromptTitleForFilename } from '@shared/promptFilename'
import { PROMPT_FOLDER_SETTINGS_FIELDS, type PromptFolderSettings } from '@shared/PromptFolder'
import { PromptStatus, type PromptPersisted } from '@shared/Prompt'
import type { PromptFolderInfoFile } from '../../src/main/DiskTypes/WorkspaceDiskTypes'
import { serializePromptMarkdown } from '../../src/main/Persistence/PromptFrontmatter'
import { PROMPT_FOLDER_SETTINGS_TEXT_FILENAMES } from '../../src/main/Persistence/PromptPersistencePaths'
import {
  VIRTUAL_FIND_FIRST_PROMPT_INDEX,
  VIRTUAL_FIND_LAST_PROMPT_INDEX,
  VIRTUAL_FIND_MARKER,
  virtualFindPromptId
} from '../helpers/VirtualFindTestConstants'

const createPromptFolderInfo = (
  displayName: string,
  promptFolderId: string
): PromptFolderInfoFile => {
  return { displayName, promptFolderId }
}

const getPromptFolderOrderPath = (folderPath: string): string =>
  `${folderPath}/_FolderInfo/FolderOrder.json`

/**
 * Configuration for creating a prompt folder
 */
export interface PromptFolderConfig {
  folderName: string
  displayName: string
  promptFolderId?: string
  folderSettings?: Partial<PromptFolderSettings>
  prompts?: Array<{
    id: string
    title?: string
    fallbackTitle?: string
    promptText: string
    createdAt?: string
    status?: PromptStatus
    completedAt?: string
  }>
}

type PromptTemplate = NonNullable<PromptFolderConfig['prompts']>[number]

const addPromptFolderSettingsFiles = (
  structure: Record<string, string | null>,
  folderPath: string,
  folder: PromptFolderConfig
): void => {
  for (const field of PROMPT_FOLDER_SETTINGS_FIELDS) {
    structure[`${folderPath}/_FolderInfo/${PROMPT_FOLDER_SETTINGS_TEXT_FILENAMES[field]}`] =
      folder.folderSettings?.[field] ?? ''
  }
}

function createSinglePromptFoldersFromPromptCollection(
  promptCollection: Record<string, PromptTemplate>
): PromptFolderConfig[] {
  return Object.values(promptCollection).map((prompt) => {
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

const createDeterministicId = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

const DEFAULT_PROMPT_TIMESTAMP = '2023-01-01T00:00:00.000Z'

const getDuplicateTitleStems = (prompts: Array<{ title: string; fallbackTitle: string }>) => {
  const titleStemCounts = new Map<string, number>()

  for (const prompt of prompts) {
    const titleStem = sanitizePromptTitleForFilename(getPromptDisplayTitle(prompt)).toLowerCase()
    titleStemCounts.set(titleStem, (titleStemCounts.get(titleStem) ?? 0) + 1)
  }

  return new Set(
    [...titleStemCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([titleStem]) => titleStem)
  )
}

const normalizePrompts = (prompts: PromptTemplate[] | undefined) => {
  const normalized: Array<PromptTemplate & { title: string; fallbackTitle: string }> = []

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
  prompts: Array<PromptTemplate & { title: string; fallbackTitle: string }>
): {
  promptIds: string[]
  promptFiles: Record<string, string>
} => {
  const promptFiles: Record<string, string> = {}
  const duplicateTitleStems = getDuplicateTitleStems(prompts)

  for (const prompt of prompts) {
    const promptData: PromptPersisted = {
      id: prompt.id,
      title: prompt.title ?? '',
      fallbackTitle: prompt.fallbackTitle ?? '',
      createdAt: prompt.createdAt ?? DEFAULT_PROMPT_TIMESTAMP,
      modifiedAt: prompt.createdAt ?? DEFAULT_PROMPT_TIMESTAMP,
      status: prompt.status ?? PromptStatus.Todo,
      promptText: prompt.promptText,
      ...(prompt.status === PromptStatus.Completed && prompt.completedAt
        ? { completedAt: prompt.completedAt }
        : {})
    }
    const displayTitle = getPromptDisplayTitle(promptData)
    const titleStem = sanitizePromptTitleForFilename(displayTitle).toLowerCase()
    const promptStem = buildPromptStem(displayTitle, prompt.id, duplicateTitleStems.has(titleStem))

    promptFiles[`${folderPath}/${promptStem}.prompt.md`] = serializePromptMarkdown(promptData)
  }

  return {
    promptIds: prompts.map((prompt) => prompt.id),
    promptFiles
  }
}

/**
 * Complete test scenarios with folders and prompts
 */
const workspaceScenarios = {
  populated: {
    description: 'Workspace with sample prompts for integration testing',
    examplesFolder: {
      folderName: 'Examples',
      displayName: 'Example Prompts',
      prompts: [samplePrompts.simple]
    },
    developmentFolder: {
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
  | 'sample' // Workspace with Examples and Development prompt folders
  | 'height' // Workspace with folders for height tests
  | 'subfolders' // Workspace with a prompt folder containing one nested subfolder
  | 'subfolders-ui' // Dedicated recursive prompt-folder screen rendering fixture
  | 'subfolders-controls' // Dedicated nested two-prompt movement-control fixture
  | 'subfolders-depth-limit' // Dedicated eight-level subfolder depth fixture
  | 'virtual' // Workspace with folders for virtualization/overscan tests
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
  subfolders: '/ws/subfolders',
  'subfolders-ui': '/ws/subfolders-ui',
  'subfolders-controls': '/ws/subfolders-controls',
  'subfolders-depth-limit': '/ws/subfolders-depth-limit',
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
  return `${workspacePath}/${workspaceName}.cthulhuprompt.json`
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
  const settingsPayload = { ...settings, workspaceId }
  const workspaceName =
    typeof settings.workspaceName === 'string'
      ? settings.workspaceName
      : getWorkspaceInfoPath(workspacePath)
          .split('/')
          .pop()!
          .replace(/\.cthulhuprompt\.json$/, '')

  const structure: Record<string, string | null> = {
    [`${workspacePath}/Prompts`]: null,
    [`${workspacePath}/Prompts/FolderOrder.json`]: JSON.stringify({ promptFolderIds: [] }, null, 2),
    [getWorkspaceInfoPath(workspacePath)]: JSON.stringify(
      { ...settingsPayload, workspaceName },
      null,
      2
    )
  }

  return structure
}

/**
 * Creates a workspace with specified prompt folders
 *
 * @param workspacePath - The path where the workspace should be created
 * @param folderConfigs - Array of folder configurations to create
 * @param workspaceOptions - Optional workspace configuration
 * @returns The filesystem structure object
 */
export function createWorkspaceWithFolders(
  workspacePath: string,
  folderConfigs: PromptFolderConfig[],
  workspaceOptions: WorkspaceOptions = {}
): Record<string, string | null> {
  // First create basic workspace
  const structure = createBasicWorkspace(workspacePath, workspaceOptions)
  const promptFolderIds: string[] = []

  // Add each folder
  for (const folder of folderConfigs) {
    const folderPath = `${workspacePath}/Prompts/${folder.folderName}`
    const { prompts } = normalizePrompts(folder.prompts)
    const { promptIds, promptFiles } = createPromptFiles(folderPath, prompts)
    const promptFolderId =
      typeof folder.promptFolderId === 'string'
        ? folder.promptFolderId
        : createDeterministicId(`${workspacePath}:${folder.folderName}`)
    promptFolderIds.push(promptFolderId)

    // Create folder metadata
    structure[getPromptFolderOrderPath(folderPath)] = JSON.stringify(
      { entryIds: promptIds },
      null,
      2
    )
    structure[`${folderPath}/_FolderInfo/FolderInfo.json`] = JSON.stringify(
      createPromptFolderInfo(folder.displayName, promptFolderId),
      null,
      2
    )
    addPromptFolderSettingsFiles(structure, folderPath, folder)
    Object.assign(structure, promptFiles)
  }
  structure[`${workspacePath}/Prompts/FolderOrder.json`] = JSON.stringify(
    { promptFolderIds },
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
      return createWorkspaceWithFolders(workspacePath, [
        { ...workspaceScenarios.populated.examplesFolder },
        { ...workspaceScenarios.populated.developmentFolder }
      ])

    case 'height': {
      const heightPromptFolders = createSinglePromptFoldersFromPromptCollection(heightTestPrompts)
      return createWorkspaceWithFolders(workspacePath, heightPromptFolders)
    }

    case 'subfolders': {
      const structure = createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Main',
          displayName: 'Main',
          prompts: [
            {
              id: 'base-before',
              title: 'Base Before',
              promptText: 'Visible base prompt before the subfolder.'
            },
            {
              id: 'base-after',
              title: 'Base After',
              promptText: 'Visible base prompt after the subfolder.'
            }
          ]
        }
      ])
      const subfolderId = createDeterministicId(`${workspacePath}:Main/Nested`)
      const subfolderPath = `${workspacePath}/Prompts/Main/Nested`
      const { prompts } = normalizePrompts([
        {
          id: 'nested-prompt',
          title: 'Nested Prompt',
          promptText: 'Prompt text from a nested prompt folder.'
        }
      ])
      const { promptIds, promptFiles } = createPromptFiles(subfolderPath, prompts)

      structure[`${workspacePath}/Prompts/Main/_FolderInfo/FolderOrder.json`] = JSON.stringify(
        { entryIds: ['base-before', subfolderId, 'base-after'] },
        null,
        2
      )
      structure[getPromptFolderOrderPath(subfolderPath)] = JSON.stringify(
        { entryIds: promptIds },
        null,
        2
      )
      structure[`${subfolderPath}/_FolderInfo/FolderInfo.json`] = JSON.stringify(
        createPromptFolderInfo('Nested', subfolderId),
        null,
        2
      )
      addPromptFolderSettingsFiles(structure, subfolderPath, {
        folderName: 'Main/Nested',
        displayName: 'Nested'
      })
      Object.assign(structure, promptFiles)

      return structure
    }

    case 'subfolders-ui': {
      const structure = createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Hierarchy',
          displayName: 'Hierarchy',
          folderSettings: {
            folderDescription: 'Root hierarchy folder description.'
          },
          prompts: [
            {
              id: 'subfolders-ui-root-before',
              title: 'Root Before',
              promptText: 'Root prompt before the nested folders.'
            },
            {
              id: 'subfolders-ui-root-after',
              title: 'Root After',
              promptText: 'Root prompt after the nested folders.'
            }
          ]
        },
        {
          folderName: 'EmptyRoot',
          displayName: 'Empty Root'
        }
      ])
      const nestedFolderId = createDeterministicId(`${workspacePath}:Hierarchy/Nested`)
      const emptyNestedFolderId = createDeterministicId(
        `${workspacePath}:Hierarchy/EmptyNested`
      )
      const grandchildFolderId = createDeterministicId(
        `${workspacePath}:Hierarchy/Nested/Grandchild`
      )
      const rootFolderPath = `${workspacePath}/Prompts/Hierarchy`
      const nestedFolderPath = `${workspacePath}/Prompts/Hierarchy/Nested`
      const emptyNestedFolderPath = `${workspacePath}/Prompts/Hierarchy/EmptyNested`
      const grandchildFolderPath = `${nestedFolderPath}/Grandchild`
      const { prompts } = normalizePrompts([
        {
          id: 'subfolders-ui-nested-prompt',
          title: 'Nested Prompt',
          promptText: 'Prompt text inside the nested folder.'
        }
      ])
      const { promptIds, promptFiles } = createPromptFiles(nestedFolderPath, prompts)
      const { prompts: grandchildPrompts } = normalizePrompts([
        {
          id: 'subfolders-ui-grandchild-prompt',
          title: 'Grandchild Prompt',
          promptText: 'Prompt text inside the grandchild folder.'
        }
      ])
      const { promptIds: grandchildPromptIds, promptFiles: grandchildPromptFiles } =
        createPromptFiles(grandchildFolderPath, grandchildPrompts)
      const { prompts: rootCompletedPrompts } = normalizePrompts([
        {
          id: 'subfolders-ui-root-completed',
          title: 'Root Completed',
          promptText: 'Completed prompt directly inside the root folder.',
          status: PromptStatus.Completed,
          completedAt: '2026-07-09T10:00:00.000Z'
        }
      ])
      const { promptFiles: rootCompletedPromptFiles } = createPromptFiles(
        `${rootFolderPath}/_Completed`,
        rootCompletedPrompts
      )
      const { prompts: nestedCompletedPrompts } = normalizePrompts([
        {
          id: 'subfolders-ui-nested-completed-1',
          title: 'Nested Completed One',
          promptText: 'First completed prompt directly inside the nested folder.',
          status: PromptStatus.Completed,
          completedAt: '2026-07-09T11:00:00.000Z'
        },
        {
          id: 'subfolders-ui-nested-completed-2',
          title: 'Nested Completed Two',
          promptText: 'Second completed prompt directly inside the nested folder.',
          status: PromptStatus.Completed,
          completedAt: '2026-07-09T12:00:00.000Z'
        }
      ])
      const { promptFiles: nestedCompletedPromptFiles } = createPromptFiles(
        `${nestedFolderPath}/_Completed`,
        nestedCompletedPrompts
      )

      structure[`${workspacePath}/Prompts/Hierarchy/_FolderInfo/FolderOrder.json`] =
        JSON.stringify(
          {
            entryIds: [
              'subfolders-ui-root-before',
              nestedFolderId,
              emptyNestedFolderId,
              'subfolders-ui-root-after'
            ]
          },
          null,
          2
        )
      structure[getPromptFolderOrderPath(nestedFolderPath)] = JSON.stringify(
        { entryIds: [...promptIds, grandchildFolderId] },
        null,
        2
      )
      structure[`${nestedFolderPath}/_FolderInfo/FolderInfo.json`] = JSON.stringify(
        createPromptFolderInfo('Nested', nestedFolderId),
        null,
        2
      )
      addPromptFolderSettingsFiles(structure, nestedFolderPath, {
        folderName: 'Hierarchy/Nested',
        displayName: 'Nested',
        folderSettings: {
          folderDescription: 'Nested folder description.'
        }
      })
      structure[getPromptFolderOrderPath(grandchildFolderPath)] = JSON.stringify(
        { entryIds: grandchildPromptIds },
        null,
        2
      )
      structure[`${grandchildFolderPath}/_FolderInfo/FolderInfo.json`] = JSON.stringify(
        createPromptFolderInfo('Grandchild', grandchildFolderId),
        null,
        2
      )
      addPromptFolderSettingsFiles(structure, grandchildFolderPath, {
        folderName: 'Hierarchy/Nested/Grandchild',
        displayName: 'Grandchild',
        folderSettings: {
          folderDescription: 'Grandchild folder description.'
        }
      })
      structure[getPromptFolderOrderPath(emptyNestedFolderPath)] = JSON.stringify(
        { entryIds: [] },
        null,
        2
      )
      structure[`${emptyNestedFolderPath}/_FolderInfo/FolderInfo.json`] = JSON.stringify(
        createPromptFolderInfo('Empty Nested', emptyNestedFolderId),
        null,
        2
      )
      addPromptFolderSettingsFiles(structure, emptyNestedFolderPath, {
        folderName: 'Hierarchy/EmptyNested',
        displayName: 'Empty Nested'
      })
      Object.assign(structure, promptFiles)
      Object.assign(structure, grandchildPromptFiles)
      Object.assign(structure, rootCompletedPromptFiles)
      Object.assign(structure, nestedCompletedPromptFiles)

      return structure
    }

    case 'subfolders-depth-limit': {
      const rootName = 'DepthRoot'
      const structure = createWorkspaceWithFolders(workspacePath, [
        { folderName: rootName, displayName: 'Depth Root' }
      ])
      let parentPath = `${workspacePath}/Prompts/${rootName}`

      for (let depth = 1; depth <= 8; depth += 1) {
        const childName = `Level${depth}`
        const childFolderName = `${rootName}/${Array.from(
          { length: depth },
          (_, index) => `Level${index + 1}`
        ).join('/')}`
        const childId = createDeterministicId(`${workspacePath}:${childFolderName}`)
        const childPath = `${parentPath}/${childName}`

        structure[getPromptFolderOrderPath(parentPath)] = JSON.stringify(
          { entryIds: [childId] },
          null,
          2
        )
        structure[getPromptFolderOrderPath(childPath)] = JSON.stringify(
          { entryIds: [] },
          null,
          2
        )
        structure[`${childPath}/_FolderInfo/FolderInfo.json`] = JSON.stringify(
          createPromptFolderInfo(`Level ${depth}`, childId),
          null,
          2
        )
        addPromptFolderSettingsFiles(structure, childPath, {
          folderName: childFolderName,
          displayName: `Level ${depth}`
        })
        parentPath = childPath
      }

      return structure
    }

    case 'subfolders-controls': {
      const structure = createWorkspaceWithFolders(workspacePath, [
        { folderName: 'Controls', displayName: 'Controls' }
      ])
      const nestedFolderId = createDeterministicId(`${workspacePath}:Controls/Nested`)
      const siblingFolderId = createDeterministicId(`${workspacePath}:Controls/Sibling`)
      const nestedFolderPath = `${workspacePath}/Prompts/Controls/Nested`
      const siblingFolderPath = `${workspacePath}/Prompts/Controls/Sibling`
      const { prompts } = normalizePrompts([
        {
          id: 'subfolders-controls-first',
          title: 'First Nested Prompt',
          promptText: 'First nested prompt for disabled movement controls.'
        },
        {
          id: 'subfolders-controls-second',
          title: 'Second Nested Prompt',
          promptText: 'Second nested prompt for disabled movement controls.'
        }
      ])
      const { promptIds, promptFiles } = createPromptFiles(nestedFolderPath, prompts)

      structure[getPromptFolderOrderPath(`${workspacePath}/Prompts/Controls`)] =
        JSON.stringify({ entryIds: [nestedFolderId, siblingFolderId] }, null, 2)
      structure[getPromptFolderOrderPath(nestedFolderPath)] = JSON.stringify(
        { entryIds: promptIds },
        null,
        2
      )
      structure[`${nestedFolderPath}/_FolderInfo/FolderInfo.json`] = JSON.stringify(
        createPromptFolderInfo('Nested', nestedFolderId),
        null,
        2
      )
      addPromptFolderSettingsFiles(structure, nestedFolderPath, {
        folderName: 'Controls/Nested',
        displayName: 'Nested'
      })
      structure[getPromptFolderOrderPath(siblingFolderPath)] = JSON.stringify(
        { entryIds: [] },
        null,
        2
      )
      structure[`${siblingFolderPath}/_FolderInfo/FolderInfo.json`] = JSON.stringify(
        createPromptFolderInfo('Sibling', siblingFolderId),
        null,
        2
      )
      addPromptFolderSettingsFiles(structure, siblingFolderPath, {
        folderName: 'Controls/Sibling',
        displayName: 'Sibling'
      })
      Object.assign(structure, promptFiles)

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

      return createWorkspaceWithFolders(workspacePath, [
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

      return createWorkspaceWithFolders(workspacePath, [
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

      return createWorkspaceWithFolders(workspacePath, [
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
 * Adds a single folder to an existing workspace
 *
 * @param workspacePath - The path to the existing workspace
 * @param folderConfig - Configuration for the folder to add
 * @returns The filesystem structure for the new folder
 */
export function addFolderToWorkspace(
  workspacePath: string,
  folderConfig: PromptFolderConfig
): Record<string, string | null> {
  const folderPath = `${workspacePath}/Prompts/${folderConfig.folderName}`
  const { prompts } = normalizePrompts(folderConfig.prompts)
  const { promptIds, promptFiles } = createPromptFiles(folderPath, prompts)
  const promptFolderId =
    typeof folderConfig.promptFolderId === 'string'
      ? folderConfig.promptFolderId
      : createDeterministicId(`${workspacePath}:${folderConfig.folderName}`)

  const structure: Record<string, string | null> = {
    [getPromptFolderOrderPath(folderPath)]: JSON.stringify({ entryIds: promptIds }, null, 2),
    [`${folderPath}/_FolderInfo/FolderInfo.json`]: JSON.stringify(
      createPromptFolderInfo(folderConfig.displayName, promptFolderId),
      null,
      2
    ),
    ...promptFiles
  }
  addPromptFolderSettingsFiles(structure, folderPath, folderConfig)

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
    folderName: string = 'TestFolder'
  ): Record<string, string | null> {
    return createWorkspaceWithFolders(workspacePath, [
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
    return createWorkspaceWithFolders(workspacePath, [
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
 * Generates a folder with many large prompts (e.g., 50 two-hundred-line prompts).
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

  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Examples',
      displayName: 'Example Prompts',
      prompts: manyLargePrompts
    }
  ])
}

/**
 * Creates a workspace with prompts but no folder structure (for testing edge cases)
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
      // Missing .cthulhuprompt.json
      break

    case 'invalid-json':
      structure[`${workspacePath}/Prompts`] = null
      structure[getWorkspaceInfoPath(workspacePath)] = '{ invalid json'
      break

    case 'missing-prompts':
      structure[getWorkspaceInfoPath(workspacePath)] = JSON.stringify(
        {
          workspaceId: createDeterministicId(workspacePath),
          workspaceName: getWorkspaceInfoPath(workspacePath)
            .split('/')
            .pop()!
            .replace(/\.cthulhuprompt\.json$/, '')
        },
        null,
        2
      )
      // Missing prompts directory
      break
  }

  return structure
}
