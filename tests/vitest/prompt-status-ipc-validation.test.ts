import { PromptStatus } from '@shared/Prompt'
import { describe, expect, it } from 'vitest'
import { parseSetPromptStatusRequest } from '../../src/main/IpcFramework/IpcValidation'

const promptFolder = {
  id: 'prompt-folder',
  kind: 'prompt' as const,
  folderName: 'Prompts',
  displayName: 'Prompts',
  completedPromptIds: [],
  categoryOrder: { categories: [{ categoryId: null, entries: [] }] },
  settings: { folderDescription: null }
}

const request = (prompt: object) => ({
  requestId: 'request-1',
  clientId: 'client-1',
  payload: {
    sourcePromptFolder: {
      id: promptFolder.id,
      expectedRevision: 2,
      data: promptFolder
    },
    rootPromptFolder: {
      id: promptFolder.id,
      expectedRevision: 2,
      data: promptFolder
    },
    prompt,
    status: PromptStatus.Completed,
    categoryOrderPlacement: { categoryId: null, previousEntryId: null }
  }
})

describe('prompt status IPC validation', () => {
  it('accepts a prompt revision reference without prompt content', () => {
    expect(
      parseSetPromptStatusRequest(
        request({ id: 'prompt-1', expectedRevision: 4 })
      ).success
    ).toBe(true)
  })

  it('rejects redundant prompt content in the revision reference', () => {
    expect(
      parseSetPromptStatusRequest(
        request({
          id: 'prompt-1',
          expectedRevision: 4,
          data: {
            id: 'prompt-1',
            title: 'Unsaved title',
            fallbackTitle: 'New Prompt',
            createdAt: '',
            modifiedAt: '',
            promptText: 'Unsaved text',
            status: PromptStatus.Todo
          }
        })
      ).success
    ).toBe(false)
  })
})
