import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromptTemplateFull } from '@shared/PromptTemplate'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'

const ipcInvokeWithPayload = vi.hoisted(() => vi.fn())
const mutatePacedRevisionUpdateTransaction = vi.hoisted(() => vi.fn())
const runRevisionMutation = vi.hoisted(() => vi.fn())
const latestMutationRecord = vi.hoisted(() => ({ value: null as object | null }))

vi.mock('@renderer/data/IpcFramework/IpcRequestInvoke', () => ({ ipcInvokeWithPayload }))
vi.mock('@renderer/data/IpcFramework/RevisionMutationLookup', () => ({
  getLatestMutationModifiedRecord: vi.fn(
    (_transaction, _collectionId, _elementId, fallback: () => unknown) =>
      latestMutationRecord.value ?? fallback()
  )
}))
vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation,
  submitPacedUpdateTransactionAndWait: vi.fn()
}))

import {
  createPromptTemplate,
  deletePromptTemplate,
  movePromptTemplate,
  mutatePacedPromptTemplateAutosaveUpdate
} from '@renderer/data/Mutations/PromptTemplateMutations'

const templateFolder = (id: string, templateIds: string[] = []) => ({
  id,
  kind: 'template' as const,
  folderName: id,
  displayName: id,
  completedPromptIds: [],
  categoryOrder: {
    categories: [
      {
        categoryId: null,
        entries: templateIds.map((id) => ({ kind: 'template' as const, id }))
      }
    ]
  },
  settings: { folderDescription: null }
})

const entityBuilders = {
  promptFolder: ({ id, data }: { id: string; data: object }) => ({
    id,
    expectedRevision: 1,
    data
  }),
  promptTemplate: ({ id, data }: { id: string; data: object }) => ({
    id,
    expectedRevision: 3,
    data
  })
}

describe('prompt template mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    latestMutationRecord.value = null
    for (const id of ['paced-template', 'new-template']) {
      promptTemplateCollection.utils.deleteAuthoritative(id)
      if (promptTemplateClientStateCollection.has(id)) {
        promptTemplateClientStateCollection.delete(id)
      }
    }
    for (const id of ['source-folder', 'destination-folder']) {
      promptFolderCollection.utils.deleteAuthoritative(id)
    }
    promptFolderCollection.utils.upsertAuthoritative({
      id: 'source-folder',
      revision: 1,
      data: templateFolder('source-folder', ['paced-template'])
    })
    promptFolderCollection.utils.upsertAuthoritative({
      id: 'destination-folder',
      revision: 1,
      data: templateFolder('destination-folder')
    })
    promptTemplateCollection.utils.upsertAuthoritative({
      id: 'paced-template',
      revision: 3,
      data: createPromptTemplateFull({
        id: 'paced-template',
        title: 'Paced Template',
        fallbackTitle: '',
        createdAt: '2026-07-24T10:00:00.000Z',
        modifiedAt: '2026-07-24T11:00:00.000Z',
        templateText: 'Use {{value}}.'
      })
    })
  })

  it('registers a paced update that sends the template IPC payload without prompt status', async () => {
    ipcInvokeWithPayload.mockResolvedValue({ success: false, error: 'stop before commit' })
    const mutateOptimistically = vi.fn()

    mutatePacedPromptTemplateAutosaveUpdate({
      templateId: 'paced-template',
      debounceMs: 2000,
      mutateOptimistically
    })
    latestMutationRecord.value = createPromptTemplateFull({
      id: 'paced-template',
      title: 'Latest Paced Template',
      fallbackTitle: '',
      createdAt: '2026-07-24T10:00:00.000Z',
      modifiedAt: '2026-07-24T11:30:00.000Z',
      templateText: 'Use the latest {{value}}.'
    })

    const options = mutatePacedRevisionUpdateTransaction.mock.calls[0]?.[0]
    expect(options).toMatchObject({
      collectionId: 'prompt-templates',
      elementId: 'paced-template',
      debounceMs: 2000,
      mutateOptimistically
    })

    await options.persistMutations({
      entities: {
        promptTemplate: entityBuilders.promptTemplate
      },
      transaction: {}
    })

    expect(ipcInvokeWithPayload).toHaveBeenCalledWith('update-prompt-template', {
      content: {
        id: 'paced-template',
        expectedRevision: 3,
        data: {
          id: 'paced-template',
          title: 'Latest Paced Template',
          fallbackTitle: '',
          createdAt: '2026-07-24T10:00:00.000Z',
          modifiedAt: '2026-07-24T11:30:00.000Z',
          templateText: 'Use the latest {{value}}.'
        }
      }
    })
  })

  it('creates a New Template through the create IPC contract', async () => {
    ipcInvokeWithPayload.mockResolvedValue({ success: false, error: 'stop before commit' })
    const template = createPromptTemplateFull({
      id: 'new-template',
      title: '',
      fallbackTitle: '',
      createdAt: '',
      modifiedAt: '',
      templateText: ''
    })

    await createPromptTemplate('source-folder', template, null)

    const options = runRevisionMutation.mock.calls[0]?.[0]
    const insertedTemplates: object[] = []
    const insertedClientStates: object[] = []
    const sourceFolder = templateFolder('source-folder', ['paced-template'])
    options.mutateOptimistically({
      collections: {
        promptTemplate: { insert: (value: object) => insertedTemplates.push(value) },
        promptTemplateClientState: {
          insert: (value: object) => insertedClientStates.push(value)
        },
        promptFolder: {
          update: (
            _id: string,
            mutate: (draft: ReturnType<typeof templateFolder>) => void
          ) => mutate(sourceFolder)
        }
      }
    })
    expect(insertedTemplates[0]).toMatchObject({
      id: 'new-template',
      title: '',
      fallbackTitle: 'New Template'
    })
    expect(insertedClientStates[0]).toEqual({
      id: 'new-template',
      isEdited: true
    })
    expect(sourceFolder.categoryOrder.categories[0]?.entries).toEqual([
      { kind: 'template', id: 'new-template' },
      { kind: 'template', id: 'paced-template' }
    ])

    await options.persistMutations({ entities: entityBuilders, transaction: {} })
    expect(ipcInvokeWithPayload).toHaveBeenCalledWith(
      'create-prompt-template',
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ fallbackTitle: 'New Template' })
        })
      })
    )
    expect(ipcInvokeWithPayload.mock.calls[0]?.[1].content.data).not.toHaveProperty('status')
  })

  it('reconciles the latest template snapshot from a delete conflict', async () => {
    await deletePromptTemplate('source-folder', 'paced-template')
    const deleteOptions = runRevisionMutation.mock.calls[0]?.[0]

    deleteOptions.handleSuccessOrConflictResponse({
      promptFolders: [],
      content: {
        id: 'paced-template',
        revision: 4,
        data: {
          id: 'paced-template',
          title: 'Authoritative Template',
          fallbackTitle: '',
          createdAt: '2026-07-24T10:00:00.000Z',
          modifiedAt: '2026-07-24T12:00:00.000Z',
          templateText: 'Latest server text.'
        }
      }
    })

    expect(promptTemplateCollection.utils.getAuthoritativeRevision('paced-template')).toBe(4)
    expect(promptTemplateCollection.get('paced-template')).toMatchObject({
      title: 'Authoritative Template',
      templateText: 'Latest server text.',
      loadingState: 'full'
    })
    expect(promptTemplateClientStateCollection.get('paced-template')).toMatchObject({
      id: 'paced-template',
      isEdited: false
    })
    expect(promptTemplateClientStateCollection.get('paced-template')).not.toHaveProperty(
      'templateText'
    )
  })

  it('sends delete and move through their template-specific IPC channels', async () => {
    ipcInvokeWithPayload.mockResolvedValue({ success: false, error: 'stop before commit' })

    await deletePromptTemplate('source-folder', 'paced-template')
    const deleteOptions = runRevisionMutation.mock.calls[0]?.[0]
    const sourceAfterDelete = templateFolder('source-folder', ['paced-template'])
    const deleteTemplate = vi.fn()
    const deleteClientState = vi.fn()
    deleteOptions.mutateOptimistically({
      collections: {
        promptTemplate: { delete: deleteTemplate },
        promptTemplateClientState: { delete: deleteClientState },
        promptFolder: {
          update: (
            _id: string,
            mutate: (draft: ReturnType<typeof templateFolder>) => void
          ) => mutate(sourceAfterDelete)
        }
      }
    })
    expect(deleteTemplate).toHaveBeenCalledWith('paced-template')
    expect(deleteClientState).toHaveBeenCalledWith('paced-template')
    expect(sourceAfterDelete.categoryOrder.categories[0]?.entries).toEqual([])
    await deleteOptions.persistMutations({ entities: entityBuilders, transaction: {} })
    expect(ipcInvokeWithPayload).toHaveBeenLastCalledWith(
      'delete-prompt-template',
      expect.objectContaining({ content: expect.objectContaining({ id: 'paced-template' }) })
    )

    await movePromptTemplate(
      'source-folder',
      'destination-folder',
      'paced-template',
      null
    )
    const moveOptions = runRevisionMutation.mock.calls[1]?.[0]
    const sourceAfterMove = templateFolder('source-folder', ['paced-template'])
    const destinationAfterMove = templateFolder('destination-folder')
    const updateTemplate = vi.fn()
    const movedClientState = {
      id: 'paced-template',
      isEdited: false
    }
    const updateClientState = vi.fn(
      (_id: string, update: (clientState: typeof movedClientState) => void) =>
        update(movedClientState)
    )
    moveOptions.mutateOptimistically({
      collections: {
        promptFolder: {
          update: (
            id: string,
            mutate: (draft: ReturnType<typeof templateFolder>) => void
          ) => mutate(id === 'source-folder' ? sourceAfterMove : destinationAfterMove)
        },
        promptTemplate: { update: updateTemplate },
        promptTemplateClientState: { update: updateClientState }
      }
    })
    expect(sourceAfterMove.categoryOrder.categories[0]?.entries).toEqual([])
    expect(destinationAfterMove.categoryOrder.categories[0]?.entries).toEqual([
      { kind: 'template', id: 'paced-template' }
    ])
    expect(updateTemplate).toHaveBeenCalledWith('paced-template', expect.any(Function))
    expect(updateClientState).toHaveBeenCalledWith('paced-template', expect.any(Function))
    expect(movedClientState.isEdited).toBe(true)
    await moveOptions.persistMutations({ entities: entityBuilders, transaction: {} })
    expect(ipcInvokeWithPayload).toHaveBeenLastCalledWith(
      'move-prompt-template',
      expect.objectContaining({
        sourcePromptFolder: expect.objectContaining({ id: 'source-folder' }),
        destinationPromptFolder: expect.objectContaining({ id: 'destination-folder' }),
        content: { id: 'paced-template', expectedRevision: 3 }
      })
    )
  })
})
