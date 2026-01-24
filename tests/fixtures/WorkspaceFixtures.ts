import { samplePrompts, heightTestPrompts } from './TestData'
import {
  VIRTUAL_FIND_FIRST_PROMPT_INDEX,
  VIRTUAL_FIND_LAST_PROMPT_INDEX,
  VIRTUAL_FIND_MARKER,
  virtualFindPromptId
} from '../helpers/VirtualFindTestConstants'
import { createPromptFolderConfig } from '../../src/shared/promptFolderConfig'

/**
 * Configuration for creating a prompt folder
 */
export interface PromptFolderConfig {
  folderName: string
  displayName: string
  promptFolderId?: string
  prompts?: Array<{
    id: string
    title?: string
    promptText: string
    creationDate?: string
    lastModifiedDate?: string
    promptFolderCount?: number
  }>
}

type PromptTemplate = NonNullable<PromptFolderConfig['prompts']>[number]

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
  return `00000000-0000-0000-0000-${suffix}`
}

const normalizePrompts = (prompts: PromptTemplate[] | undefined) => {
  // Normalize prompt counts for test fixtures.
  const normalized = (prompts ?? []).map((prompt, index) => {
    const promptFolderCount = index + 1
    const title = typeof prompt.title === 'string' ? prompt.title : ''
    return { ...prompt, title, promptFolderCount }
  })

  return { prompts: normalized, promptCount: normalized.length }
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
          creationDate: '2023-01-02T12:00:00.000Z',
          lastModifiedDate: '2023-01-02T12:00:00.000Z'
        },
        {
          id: 'dev-2',
          title: 'Bug Analysis',
          promptText: 'Analyze this bug and suggest fixes',
          creationDate: '2023-01-03T12:00:00.000Z',
          lastModifiedDate: '2023-01-03T12:00:00.000Z'
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
  virtual: '/ws/virtual',
  'long-wrapped-lines': '/ws/long-wrapped-lines',
  'virtual-placeholder': '/ws/virtual-placeholder'
}

export function getWorkspacePath(scenario: WorkspaceScenario): string {
  return DEFAULT_WORKSPACES[scenario]
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

  const structure: Record<string, string | null> = {
    [`${workspacePath}/prompts`]: null,
    [`${workspacePath}/WorkspaceInfo.json`]: JSON.stringify(settingsPayload, null, 2)
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

  // Add each folder
  for (const folder of folderConfigs) {
    const folderPath = `${workspacePath}/prompts/${folder.folderName}`
    const { prompts, promptCount } = normalizePrompts(folder.prompts)
    const promptFolderId =
      typeof folder.promptFolderId === 'string'
        ? folder.promptFolderId
        : createDeterministicId(`${workspacePath}:${folder.folderName}`)

    // Create folder metadata
    structure[`${folderPath}/PromptFolder.json`] = JSON.stringify(
      createPromptFolderConfig(folder.displayName, promptCount, promptFolderId),
      null,
      2
    )

    // Create prompts file
    const promptsData = {
      metadata: { version: 1 },
      prompts
    }
    structure[`${folderPath}/Prompts.json`] = JSON.stringify(promptsData, null, 2)
  }

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
          creationDate: base.creationDate,
          lastModifiedDate: base.lastModifiedDate
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
        creationDate: twentyLineBase.creationDate,
        lastModifiedDate: twentyLineBase.lastModifiedDate
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
        creationDate: base.creationDate,
        lastModifiedDate: base.lastModifiedDate
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
  const folderPath = `${workspacePath}/prompts/${folderConfig.folderName}`
  const { prompts, promptCount } = normalizePrompts(folderConfig.prompts)
  const promptFolderId =
    typeof folderConfig.promptFolderId === 'string'
      ? folderConfig.promptFolderId
      : createDeterministicId(`${workspacePath}:${folderConfig.folderName}`)

  return {
    [`${folderPath}/PromptFolder.json`]: JSON.stringify(
      createPromptFolderConfig(folderConfig.displayName, promptCount, promptFolderId),
      null,
      2
    ),
    [`${folderPath}/Prompts.json`]: JSON.stringify(
      {
        metadata: { version: 1 },
        prompts
      },
      null,
      2
    )
  }
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
      structure[`${workspacePath}/prompts`] = null
      // Missing WorkspaceInfo.json
      break

    case 'invalid-json':
      structure[`${workspacePath}/prompts`] = null
      structure[`${workspacePath}/WorkspaceInfo.json`] = '{ invalid json'
      break

    case 'missing-prompts':
      structure[`${workspacePath}/WorkspaceInfo.json`] = JSON.stringify(
        { workspaceId: createDeterministicId(workspacePath) },
        null,
        2
      )
      // Missing prompts directory
      break
  }

  return structure
}
