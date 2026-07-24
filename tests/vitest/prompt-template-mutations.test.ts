import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromptTemplateFull } from '@shared/PromptTemplate'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { promptTemplateDraftCollection } from '@renderer/data/Collections/PromptTemplateDraftCollection'

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
  entries: templateIds.map((templateId) => ({ kind: 'template' as const, id: templateId })),
  completedPromptIds: [],
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
      if (promptTemplateDraftCollection.has(id)) promptTemplateDraftCollection.delete(id)
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
    const insertedDrafts: object[] = []
    const sourceFolder = templateFolder('source-folder', ['paced-template'])
    options.mutateOptimistically({
      collections: {
        promptTemplate: { insert: (value: object) => insertedTemplates.push(value) },
        promptTemplateDraft: { insert: (value: object) => insertedDrafts.push(value) },
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
    expect(insertedDrafts[0]).toMatchObject({
      id: 'new-template',
      fallbackTitle: 'New Template',
      isEdited: true
    })
    expect(sourceFolder.entries).toEqual([
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

  it('sends delete and move through their template-specific IPC channels', async () => {
    ipcInvokeWithPayload.mockResolvedValue({ success: false, error: 'stop before commit' })

    await deletePromptTemplate('source-folder', 'paced-template')
    const deleteOptions = runRevisionMutation.mock.calls[0]?.[0]
    const sourceAfterDelete = templateFolder('source-folder', ['paced-template'])
    const deleteTemplate = vi.fn()
    const deleteDraft = vi.fn()
    deleteOptions.mutateOptimistically({
      collections: {
        promptTemplate: { delete: deleteTemplate },
        promptTemplateDraft: { delete: deleteDraft },
        promptFolder: {
          update: (
            _id: string,
            mutate: (draft: ReturnType<typeof templateFolder>) => void
          ) => mutate(sourceAfterDelete)
        }
      }
    })
    expect(deleteTemplate).toHaveBeenCalledWith('paced-template')
    expect(deleteDraft).toHaveBeenCalledWith('paced-template')
    expect(sourceAfterDelete.entries).toEqual([])
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
    const updateDraft = vi.fn()
    moveOptions.mutateOptimistically({
      collections: {
        promptFolder: {
          update: (
            id: string,
            mutate: (draft: ReturnType<typeof templateFolder>) => void
          ) => mutate(id === 'source-folder' ? sourceAfterMove : destinationAfterMove)
        },
        promptTemplate: { update: updateTemplate },
        promptTemplateDraft: { update: updateDraft }
      }
    })
    expect(sourceAfterMove.entries).toEqual([])
    expect(destinationAfterMove.entries).toEqual([
      { kind: 'template', id: 'paced-template' }
    ])
    expect(updateTemplate).toHaveBeenCalledWith('paced-template', expect.any(Function))
    expect(updateDraft).toHaveBeenCalledWith('paced-template', expect.any(Function))
    await moveOptions.persistMutations({ entities: entityBuilders, transaction: {} })
    expect(ipcInvokeWithPayload).toHaveBeenLastCalledWith(
      'move-prompt-template',
      expect.objectContaining({
        sourcePromptFolder: expect.objectContaining({ id: 'source-folder' }),
        destinationPromptFolder: expect.objectContaining({ id: 'destination-folder' }),
        content: expect.objectContaining({ id: 'paced-template' })
      })
    )
  })
})
