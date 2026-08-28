import { describe, expect, it } from 'vitest'
import {
  parseCreatePromptRequest,
  parseCreatePromptTemplateRequest,
  parseMovePromptTemplateRequest,
  parseUpdatePromptFolderSettingsRequest
} from '../../src/main/IpcFramework/IpcValidation'

const templateFolder = {
  id: 'template-folder',
  kind: 'template',
  folderName: 'Templates',
  displayName: 'Templates',
  completedPromptIds: [],
  categoryOrder: { categories: [{ categoryId: null, entries: [] }] },
  settings: { folderDescription: null }
}

const request = (payload: object) => ({
  requestId: 'request-1',
  clientId: 'client-1',
  payload
})

describe('prompt template IPC validation', () => {
  it('requires an explicit nullable category placement', () => {
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
    ).toBe(false)
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
          categoryId: 'category-a',
          previousEntryId: null
        })
      ).success
    ).toBe(true)
  })

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
          categoryId: null,
          previousEntryId: null
        })
      ).success
    ).toBe(true)
  })

  it('accepts a template move reference without template content', () => {
    expect(
      parseMovePromptTemplateRequest(
        request({
          sourcePromptFolder: {
            id: templateFolder.id,
            expectedRevision: 1,
            data: templateFolder
          },
          destinationPromptFolder: {
            id: templateFolder.id,
            expectedRevision: 1,
            data: templateFolder
          },
          content: { id: 'template-1', expectedRevision: 3 },
          categoryId: null,
          previousEntryId: null
        })
      ).success
    ).toBe(true)
  })

  it('rejects redundant template content in a move reference', () => {
    expect(
      parseMovePromptTemplateRequest(
        request({
          sourcePromptFolder: {
            id: templateFolder.id,
            expectedRevision: 1,
            data: templateFolder
          },
          destinationPromptFolder: {
            id: templateFolder.id,
            expectedRevision: 1,
            data: templateFolder
          },
          content: {
            id: 'template-1',
            expectedRevision: 3,
            data: {
              id: 'template-1',
              title: 'Template',
              fallbackTitle: '',
              createdAt: '',
              modifiedAt: '',
              templateText: ''
            }
          },
          categoryId: null,
          previousEntryId: null
        })
      ).success
    ).toBe(false)
  })

  it('rejects unsupported settings fields on template folders', () => {
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
                unsupported: null
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
          categoryId: null,
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
          categoryId: null,
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
                folderDescription: null
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
              templates: [
                { id: 'template-1' },
                { id: 'template-2' },
                { id: 'template-1' }
              ],
              status: 'Todo'
            }
          },
          categoryId: null,
          previousEntryId: null
        })
      ).success
    ).toBe(true)
  })

  it('rejects prompt template references without object ids', () => {
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
                folderDescription: null
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
              templates: ['template-1'],
              status: 'Todo'
            }
          },
          categoryId: null,
          previousEntryId: null
        })
      ).success
    ).toBe(false)
  })
})
