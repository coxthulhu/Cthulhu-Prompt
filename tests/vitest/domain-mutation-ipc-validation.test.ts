import { describe, expect, it } from 'vitest'
import {
  parseDeleteCategoryDomainMutationRequest,
  parseMovePromptDomainMutationRequest,
  parseMovePromptTemplateDomainMutationRequest
} from '../../src/main/IpcFramework/IpcValidation'

/** Wraps a domain command and expectations in the standard IPC request context. */
const createRequest = (command: object, expectations: object[]) => ({
  requestId: 'request',
  clientId: 'client',
  payload: { command, expectations }
})

describe('domain mutation IPC validation', () => {
  it('accepts revision and absent expectations for a valid prompt move', () => {
    /** Valid prompt movement wire request. */
    const request = createRequest(
      {
        kind: 'prompt',
        sourcePromptFolderId: 'source',
        destinationPromptFolderId: 'destination',
        contentId: 'prompt',
        categoryId: null,
        previousEntryId: null
      },
      [
        {
          entityType: 'promptFolder',
          id: 'source',
          expected: 'revision',
          revision: 2
        },
        { entityType: 'prompt', id: 'prompt', expected: 'absent' }
      ]
    )
    expect(parseMovePromptDomainMutationRequest(request)).toEqual({
      success: true,
      value: request
    })
  })

  it('rejects a command kind that does not match its movement channel', () => {
    /** Template command sent through the prompt-specific parser. */
    const request = createRequest(
      {
        kind: 'template',
        sourcePromptFolderId: 'source',
        destinationPromptFolderId: 'destination',
        contentId: 'template',
        categoryId: null,
        previousEntryId: null
      },
      []
    )
    expect(parseMovePromptDomainMutationRequest(request)).toEqual({
      success: false,
      requestId: 'request',
      clientId: 'client'
    })
    expect(parseMovePromptTemplateDomainMutationRequest(request).success).toBe(true)
  })

  it('rejects malformed and extra expectation fields', () => {
    /** Revision expectation missing its required revision field. */
    const missingRevision = createRequest(
      {
        categoryId: 'category',
        promptFolderId: 'root',
        modifiedAt: 'timestamp'
      },
      [{ entityType: 'category', id: 'category', expected: 'revision' }]
    )
    /** Absent expectation carrying an unexpected revision field. */
    const extraRevision = createRequest(
      {
        categoryId: 'category',
        promptFolderId: 'root',
        modifiedAt: 'timestamp'
      },
      [{ entityType: 'category', id: 'category', expected: 'absent', revision: 0 }]
    )
    expect(parseDeleteCategoryDomainMutationRequest(missingRevision).success).toBe(false)
    expect(parseDeleteCategoryDomainMutationRequest(extraRevision).success).toBe(false)
  })

  it('rejects legacy full entity data in a move revision expectation', () => {
    /** Template movement request carrying data that the domain expectation contract omits. */
    const request = createRequest(
      {
        kind: 'template',
        sourcePromptFolderId: 'source',
        destinationPromptFolderId: 'destination',
        contentId: 'template',
        categoryId: null,
        previousEntryId: null
      },
      [
        {
          entityType: 'promptTemplate',
          id: 'template',
          expected: 'revision',
          revision: 3,
          data: { id: 'template' }
        }
      ]
    )
    expect(parseMovePromptTemplateDomainMutationRequest(request).success).toBe(false)
  })

  it('rejects extra command fields', () => {
    /** Category command containing an unrecognized legacy payload field. */
    const request = createRequest(
      {
        categoryId: 'category',
        promptFolderId: 'root',
        modifiedAt: 'timestamp',
        category: { id: 'legacy' }
      },
      []
    )
    expect(parseDeleteCategoryDomainMutationRequest(request).success).toBe(false)
  })
})
