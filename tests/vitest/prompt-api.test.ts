import { describe, it, expect, beforeEach } from 'vitest'
import { vol } from 'memfs'
import { PromptAPI } from '../../src/main/prompt-api'
import { vitestHelpers } from '../helpers/VitestWorkspaceHelpers'
import { samplePrompts } from '../fixtures/TestData'

describe('PromptAPI', () => {
  beforeEach(() => {
    vol.reset()
    // Setup a valid workspace using helper
    vitestHelpers.createBasicWorkspace('/workspace')
    vol.fromJSON({
      '/workspace/Prompts/TestFolder': null
    })
  })

  describe('createPrompt', () => {
    it('should create a new prompt successfully', async () => {
      const request = {
        workspacePath: '/workspace',
        folderName: 'TestFolder',
        title: 'Test Prompt',
        promptText: 'This is a test prompt'
      }

      const result = await PromptAPI.createPrompt(request)

      expect(result.success).toBe(true)
      expect(result.prompt?.title).toBe('Test Prompt')
      expect(result.prompt?.promptText).toBe('This is a test prompt')
      expect(result.prompt?.id).toBeDefined()
      expect(result.prompt?.creationDate).toBeDefined()
      expect(result.prompt?.lastModifiedDate).toBeDefined()
      expect(result.prompt?.promptFolderCount).toBe(1)

      // Verify file was created
      const filePath = '/workspace/Prompts/TestFolder/Prompts.json'
      expect(vol.existsSync(filePath)).toBe(true)
    })

    it('should fail for invalid workspace', async () => {
      const request = {
        workspacePath: '/invalid',
        folderName: 'TestFolder',
        title: 'Test Prompt',
        promptText: 'This is a test prompt'
      }

      const result = await PromptAPI.createPrompt(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid workspace path')
    })
  })

  describe('loadPrompts', () => {
    it('should load prompts from existing file', async () => {
      // Use sample prompts from fixtures
      const promptsData = {
        metadata: { version: 1 },
        prompts: [samplePrompts.simple, samplePrompts.complex]
      }

      vol.fromJSON({
        '/workspace/Prompts/TestFolder/Prompts.json': JSON.stringify(promptsData, null, 2)
      })

      const request = {
        workspacePath: '/workspace',
        folderName: 'TestFolder'
      }

      const result = await PromptAPI.loadPrompts(request)

      expect(result.success).toBe(true)
      expect(result.prompts).toHaveLength(2)
      expect(result.prompts![0].title).toBe(samplePrompts.simple.title)
      expect(result.prompts![1].title).toBe(samplePrompts.complex.title)
      expect(result.prompts![0].promptFolderCount).toBe(1)
      expect(result.prompts![1].promptFolderCount).toBe(2)
    })

    it('should create empty prompts file when none exists', async () => {
      const request = {
        workspacePath: '/workspace',
        folderName: 'TestFolder'
      }

      const result = await PromptAPI.loadPrompts(request)

      expect(result.success).toBe(true)
      expect(result.prompts).toEqual([])

      // Verify empty file was created
      const filePath = '/workspace/Prompts/TestFolder/Prompts.json'
      expect(vol.existsSync(filePath)).toBe(true)
      const content = JSON.parse(vol.readFileSync(filePath, 'utf8'))
      expect(content.prompts).toEqual([])
    })
  })

  describe('updatePrompt', () => {
    beforeEach(() => {
      // Use sample prompt for consistency
      const testPrompt = { ...samplePrompts.simple, id: 'existing-id' }
      const promptsData = {
        metadata: { version: 1 },
        prompts: [testPrompt]
      }

      vol.fromJSON({
        '/workspace/Prompts/TestFolder/Prompts.json': JSON.stringify(promptsData, null, 2)
      })
    })

    it('should update existing prompt successfully', async () => {
      const request = {
        workspacePath: '/workspace',
        folderName: 'TestFolder',
        id: 'existing-id',
        title: 'Updated Title',
        promptText: 'Updated text'
      }

      const result = await PromptAPI.updatePrompt(request)

      expect(result.success).toBe(true)
      expect(result.prompt?.title).toBe('Updated Title')
      expect(result.prompt?.promptText).toBe('Updated text')
      expect(result.prompt?.creationDate).toBe(samplePrompts.simple.creationDate)
      expect(result.prompt?.lastModifiedDate).not.toBe(samplePrompts.simple.lastModifiedDate)
    })

    it('should fail when prompt not found', async () => {
      const request = {
        workspacePath: '/workspace',
        folderName: 'TestFolder',
        id: 'non-existent-id',
        title: 'Updated Title',
        promptText: 'Updated text'
      }

      const result = await PromptAPI.updatePrompt(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Prompt not found')
    })
  })

  describe('deletePrompt', () => {
    beforeEach(() => {
      // Use sample prompts with modified IDs for delete test
      const promptToDelete = { ...samplePrompts.simple, id: 'to-delete' }
      const promptToKeep = { ...samplePrompts.complex, id: 'to-keep' }

      const promptsData = {
        metadata: { version: 1 },
        prompts: [promptToDelete, promptToKeep]
      }

      vol.fromJSON({
        '/workspace/Prompts/TestFolder/Prompts.json': JSON.stringify(promptsData, null, 2)
      })
    })

    it('should delete prompt successfully', async () => {
      const request = {
        workspacePath: '/workspace',
        folderName: 'TestFolder',
        id: 'to-delete'
      }

      const result = await PromptAPI.deletePrompt(request)

      expect(result.success).toBe(true)

      // Verify prompt was removed
      const loadResult = await PromptAPI.loadPrompts({
        workspacePath: '/workspace',
        folderName: 'TestFolder'
      })

      expect(loadResult.prompts).toHaveLength(1)
      expect(loadResult.prompts![0].id).toBe('to-keep')
    })

    it('should fail when prompt not found', async () => {
      const request = {
        workspacePath: '/workspace',
        folderName: 'TestFolder',
        id: 'non-existent'
      }

      const result = await PromptAPI.deletePrompt(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Prompt not found')
    })
  })

  describe('createInitialPromptsFile', () => {
    it('should create initial prompts file with correct structure', () => {
      // Setup the directory structure first
      vol.fromJSON({
        '/test-folder': null
      })

      PromptAPI.createInitialPromptsFile('/test-folder')

      const filePath = '/test-folder/Prompts.json'
      expect(vol.existsSync(filePath)).toBe(true)

      const content = JSON.parse(vol.readFileSync(filePath, 'utf8'))
      expect(content.metadata.version).toBe(1)
      expect(content.prompts).toEqual([])
    })
  })
})
