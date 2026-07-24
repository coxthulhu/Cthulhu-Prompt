import { describe, expect, it } from 'vitest'
import {
  parseCreatePromptRequest,
  parseCreatePromptTemplateRequest,
  parseUpdatePromptFolderSettingsRequest
} from '../../src/main/IpcFramework/IpcValidation'

const templateFolder = {
  id: 'template-folder',
  kind: 'template',
  folderName: 'Templates',
  displayName: 'Templates',
  entries: [],
  completedPromptIds: [],
  settings: { folderDescription: null }
}

const request = (payload: object) => ({
  requestId: 'request-1',
  clientId: 'client-1',
  payload
})

describe('prompt template IPC validation', () => {
  it('accepts template create data without status fields', () => {
    expect(
      parseCreatePromptTemplateRequest(
        request({
          promptFolder: { id: templateFolder.id, expectedRevision: 1, data: templateFolder },
          content: {
            id: 'template-1',
            expectedRevision: 0,
            data: {
              id: 'template-1',
              title: '',
              fallbackTitle: 'New Template',
              createdAt: '',
              modifiedAt: '',
              templateText: ''
            }
          },
          previousEntryId: null
        })
      ).success
    ).toBe(true)
  })

  it('rejects prefix and suffix fields on template folders', () => {
    expect(
      parseCreatePromptTemplateRequest(
        request({
          promptFolder: {
            id: templateFolder.id,
            expectedRevision: 1,
            data: {
              ...templateFolder,
              settings: {
                folderDescription: null,
                folderPrefix: null,
                folderSuffix: null
              }
            }
          },
          content: {
            id: 'template-1',
            expectedRevision: 0,
            data: {
              id: 'template-1',
              title: '',
              fallbackTitle: 'New Template',
              createdAt: '',
              modifiedAt: '',
              templateText: ''
            }
          },
          previousEntryId: null
        })
      ).success
    ).toBe(false)
  })

  it('rejects prompt status fields on template content', () => {
    expect(
      parseCreatePromptTemplateRequest(
        request({
          promptFolder: { id: templateFolder.id, expectedRevision: 1, data: templateFolder },
          content: {
            id: 'template-1',
            expectedRevision: 0,
            data: {
              id: 'template-1',
              title: '',
              fallbackTitle: 'New Template',
              createdAt: '',
              modifiedAt: '',
              templateText: '',
              status: 'Todo'
            }
          },
          previousEntryId: null
        })
      ).success
    ).toBe(false)
  })

  it('accepts description-only template folder settings updates', () => {
    expect(
      parseUpdatePromptFolderSettingsRequest(
        request({
          promptFolder: {
            id: templateFolder.id,
            expectedRevision: 1,
            data: { folderDescription: 'Reusable templates' }
          }
        })
      ).success
    ).toBe(true)
  })

  it('keeps prompt create validation on the shared content envelope', () => {
    expect(
      parseCreatePromptRequest(
        request({
          promptFolder: {
            id: 'prompt-folder',
            expectedRevision: 1,
            data: {
              ...templateFolder,
              id: 'prompt-folder',
              kind: 'prompt',
              settings: {
                folderDescription: null,
                folderPrefix: null,
                folderSuffix: null
              }
            }
          },
          content: {
            id: 'prompt-1',
            expectedRevision: 0,
            data: {
              id: 'prompt-1',
              title: '',
              fallbackTitle: 'New Prompt',
              createdAt: '',
              modifiedAt: '',
              promptText: '',
              status: 'Todo'
            }
          },
          previousEntryId: null
        })
      ).success
    ).toBe(true)
  })
})
