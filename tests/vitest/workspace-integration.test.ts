import { describe, it, expect, beforeEach } from 'vitest'
import { vol } from 'memfs'
import { WorkspaceManager } from '../../src/main/workspace'
import { PromptAPI } from '../../src/main/prompt-api'

describe('Workspace Integration Tests', () => {
  beforeEach(() => {
    vol.reset()
  })

  describe('Complete workflow: workspace -> folder -> prompts', () => {
    it('should support full workflow from workspace creation to prompt management', async () => {
      const workspacePath = '/integration-workspace'

      // Step 1: Create workspace
      const createResult = await WorkspaceManager.createWorkspace(workspacePath)
      expect(createResult.success).toBe(true)
      expect(WorkspaceManager.validateWorkspace(workspacePath)).toBe(true)

      // Step 2: Create prompt folder
      const folderResult = await WorkspaceManager.createPromptFolder(
        workspacePath,
        'Integration Test Folder'
      )
      expect(folderResult.success).toBe(true)
      expect(folderResult.folder?.folderName).toBe('IntegrationTestFolder')
      expect(folderResult.folder?.displayName).toBe('Integration Test Folder')

      // Step 3: Create prompt
      const createPromptResult = await PromptAPI.createPrompt({
        workspacePath,
        folderName: 'IntegrationTestFolder',
        title: 'Integration Test Prompt',
        promptText: 'This prompt was created during integration testing'
      })
      expect(createPromptResult.success).toBe(true)
      expect(createPromptResult.prompt?.title).toBe('Integration Test Prompt')

      // Step 4: Load prompts to verify
      const loadResult = await PromptAPI.loadPrompts({
        workspacePath,
        folderName: 'IntegrationTestFolder'
      })
      expect(loadResult.success).toBe(true)
      expect(loadResult.prompts).toHaveLength(1)
      expect(loadResult.prompts![0].title).toBe('Integration Test Prompt')

      // Step 5: Load folders to verify structure
      const foldersResult = await WorkspaceManager.loadPromptFolders(workspacePath)
      expect(foldersResult.success).toBe(true)
      expect(foldersResult.folders).toHaveLength(1)
      expect(foldersResult.folders![0].displayName).toBe('Integration Test Folder')
    })

    it('should handle multiple folders and prompts', async () => {
      const workspacePath = '/multi-folder-workspace'

      // Create workspace
      await WorkspaceManager.createWorkspace(workspacePath)

      // Create multiple folders
      await WorkspaceManager.createPromptFolder(workspacePath, 'First Folder')
      await WorkspaceManager.createPromptFolder(workspacePath, 'Second Folder')

      // Add prompts to each folder
      await PromptAPI.createPrompt({
        workspacePath,
        folderName: 'FirstFolder',
        title: 'First Folder Prompt',
        promptText: 'Prompt in first folder'
      })

      await PromptAPI.createPrompt({
        workspacePath,
        folderName: 'SecondFolder',
        title: 'Second Folder Prompt',
        promptText: 'Prompt in second folder'
      })

      // Verify folder structure
      const foldersResult = await WorkspaceManager.loadPromptFolders(workspacePath)
      expect(foldersResult.success).toBe(true)
      expect(foldersResult.folders).toHaveLength(2)

      // Verify prompts in each folder
      const firstFolderPrompts = await PromptAPI.loadPrompts({
        workspacePath,
        folderName: 'FirstFolder'
      })
      expect(firstFolderPrompts.prompts).toHaveLength(1)
      expect(firstFolderPrompts.prompts![0].title).toBe('First Folder Prompt')

      const secondFolderPrompts = await PromptAPI.loadPrompts({
        workspacePath,
        folderName: 'SecondFolder'
      })
      expect(secondFolderPrompts.prompts).toHaveLength(1)
      expect(secondFolderPrompts.prompts![0].title).toBe('Second Folder Prompt')
    })
  })

  describe('Error scenarios integration', () => {
    it('should handle cascading failures gracefully', async () => {
      // Try to create prompt in non-existent workspace/folder
      const createResult = await PromptAPI.createPrompt({
        workspacePath: '/non-existent',
        folderName: 'NonExistent',
        title: 'Failed Prompt',
        promptText: 'This should fail'
      })

      expect(createResult.success).toBe(false)
      expect(createResult.error).toBe('Invalid workspace path')

      // Try to load from non-existent workspace
      const loadResult = await PromptAPI.loadPrompts({
        workspacePath: '/non-existent',
        folderName: 'NonExistent'
      })

      expect(loadResult.success).toBe(false)
      expect(loadResult.error).toBe('Invalid workspace path')
    })

    it('should maintain data integrity during partial failures', async () => {
      const workspacePath = '/partial-failure-workspace'

      // Setup workspace with folder and prompt
      await WorkspaceManager.createWorkspace(workspacePath)
      await WorkspaceManager.createPromptFolder(workspacePath, 'Test Folder')
      const createResult = await PromptAPI.createPrompt({
        workspacePath,
        folderName: 'TestFolder',
        title: 'Original Prompt',
        promptText: 'Original text'
      })

      const originalId = createResult.prompt!.id

      // Try to update non-existent prompt
      const updateResult = await PromptAPI.updatePrompt({
        workspacePath,
        folderName: 'TestFolder',
        id: 'non-existent-id',
        title: 'Failed Update',
        promptText: 'Failed text'
      })

      expect(updateResult.success).toBe(false)

      // Verify original prompt is still intact
      const loadResult = await PromptAPI.loadPrompts({
        workspacePath,
        folderName: 'TestFolder'
      })

      expect(loadResult.success).toBe(true)
      expect(loadResult.prompts).toHaveLength(1)
      expect(loadResult.prompts![0].id).toBe(originalId)
      expect(loadResult.prompts![0].title).toBe('Original Prompt')
    })
  })
})
