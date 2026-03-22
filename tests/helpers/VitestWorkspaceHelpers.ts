import { vol } from 'memfs'
import {
  createBasicWorkspace,
  createWorkspaceWithFolders,
  setupWorkspaceScenario,
  addFolderToWorkspace,
  createInvalidWorkspace,
  createCorruptedWorkspace,
  testHelpers,
  type PromptFolderConfig,
  type WorkspaceOptions,
  type WorkspaceScenario
} from '../fixtures/WorkspaceFixtures'

/**
 * Vitest-compatible wrappers that automatically call vol.fromJSON()
 * These functions maintain backward compatibility for vitest tests
 */
export const vitestHelpers = {
  /**
   * Creates a basic workspace and applies it to the mock filesystem (for vitest)
   */
  createBasicWorkspace(workspacePath: string, options: WorkspaceOptions = {}): void {
    const structure = createBasicWorkspace(workspacePath, options)
    vol.fromJSON(structure)
  },

  /**
   * Creates a workspace with folders and applies it to the mock filesystem (for vitest)
   */
  createWorkspaceWithFolders(
    workspacePath: string,
    folderConfigs: PromptFolderConfig[],
    workspaceOptions: WorkspaceOptions = {}
  ): void {
    const structure = createWorkspaceWithFolders(workspacePath, folderConfigs, workspaceOptions)
    vol.fromJSON(structure)
  },

  /**
   * Sets up a workspace scenario and applies it to the mock filesystem (for vitest)
   */
  setupWorkspaceScenario(workspacePath: string, scenario: WorkspaceScenario): void {
    const structure = setupWorkspaceScenario(workspacePath, scenario)
    vol.fromJSON(structure)
  },

  /**
   * Creates a workspace with sample prompts using predefined data and applies it to the mock filesystem (for vitest)
   */
  createWorkspaceWithSamplePrompts(workspacePath: string, folderName: string = 'TestFolder'): void {
    const structure = testHelpers.createWorkspaceWithSamplePrompts(workspacePath, folderName)
    vol.fromJSON(structure)
  },

  /**
   * Creates a minimal workspace setup for basic testing and applies it to the mock filesystem (for vitest)
   */
  createMinimalWorkspace(workspacePath: string): void {
    const structure = testHelpers.createMinimalWorkspace(workspacePath)
    vol.fromJSON(structure)
  },

  /**
   * Creates workspace with specific prompt content for testing and applies it to the mock filesystem (for vitest)
   */
  createWorkspaceWithPrompt(workspacePath: string, folderName: string, promptData: any): void {
    const structure = testHelpers.createWorkspaceWithPrompt(workspacePath, folderName, promptData)
    vol.fromJSON(structure)
  },

  /**
   * Adds a single folder to an existing workspace and applies it to the mock filesystem (for vitest)
   */
  addFolderToWorkspace(workspacePath: string, folderConfig: PromptFolderConfig): void {
    const structure = addFolderToWorkspace(workspacePath, folderConfig)
    vol.fromJSON(structure)
  },

  /**
   * Creates a workspace with prompts but no folder structure (for testing edge cases) and applies it to the mock filesystem (for vitest)
   */
  createInvalidWorkspace(workspacePath: string): void {
    const structure = createInvalidWorkspace(workspacePath)
    vol.fromJSON(structure)
  },

  /**
   * Creates a corrupted workspace for error testing and applies it to the mock filesystem (for vitest)
   */
  createCorruptedWorkspace(
    workspacePath: string,
    corruptionType: 'missing-settings' | 'invalid-json' | 'missing-prompts'
  ): void {
    const structure = createCorruptedWorkspace(workspacePath, corruptionType)
    vol.fromJSON(structure)
  }
}
