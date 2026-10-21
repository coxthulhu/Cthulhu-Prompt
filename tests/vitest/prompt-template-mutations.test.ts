import { setPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'
import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { createPromptStatusFolderLayouts } from '@shared/domain/prompt-collection/PromptCollection'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromptTemplateFull } from '@shared/domain/prompt-template/PromptTemplate'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'

const mutatePacedRevisionUpdateTransaction = vi.hoisted(() => vi.fn())
const runRevisionMutation = vi.hoisted(() => vi.fn())
/** Stable transaction identity returned by the paced mutation mock. */
const pacedTransaction = {}

vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation,
  submitPacedUpdateTransactionAndWait: vi.fn()
}))

import {
  createPromptTemplate,
  deletePromptTemplate,
  mutatePacedPromptTemplateAutosaveUpdate
} from '@renderer/data/Mutations/PromptTemplateMutations'

const templateCollection = (id: string, templateIds: string[] = []) => ({
  id,
  kind: 'template' as const,
  folderName: id,
  displayName: id,
  statusFolders: createPromptStatusFolderLayouts({ categoryOrders: { active: {
    categories: [
      {
        categoryId: null,
        entries: templateIds.map((id) => ({ kind: 'template' as const, id }))
      }
    ]
  } } }),
  settings: { collectionDescription: null }
})

describe('prompt template mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutatePacedRevisionUpdateTransaction.mockReturnValue(pacedTransaction)
    for (const id of ['paced-template', 'new-template']) {
      promptTemplatesCollection.utils.deleteAuthoritative(id)
      if (promptTemplateClientStateCollection.has(id)) {
        promptTemplateClientStateCollection.delete(id)
      }
    }
    for (const id of ['source-collection', 'destination-collection']) {
      promptCollectionsCollection.utils.deleteAuthoritative(id)
    }
    workspaceCollection.utils.deleteAuthoritative('template-workspace')
    promptCollectionsCollection.utils.upsertAuthoritative({
      id: 'source-collection',
      revision: 1,
      data: templateCollection('source-collection', ['paced-template'])
    })
    workspaceCollection.utils.upsertAuthoritative({
      id: 'template-workspace',
      revision: 1,
      data: {
        id: 'template-workspace',
        workspacePath: 'C:\\Workspace',
        workspaceName: 'Workspace',
        /** Existing fixtures start without user favorites. */
        favoriteCollectionIds: { prompt: [], template: [] },
        promptCollectionEntries: [],
        templateCollectionEntries: [
          { kind: 'collection', id: 'source-collection' },
          { kind: 'collection', id: 'destination-collection' }
        ]
      }
    })
    promptCollectionsCollection.utils.upsertAuthoritative({
      id: 'destination-collection',
      revision: 1,
      data: templateCollection('destination-collection')
    })
    promptTemplatesCollection.utils.upsertAuthoritative({
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

  it('registers a paced update that sends a single-target template domain command', async () => {
    mutatePacedPromptTemplateAutosaveUpdate({
      templateId: 'paced-template',
      debounceMs: 2000,
      mutateContent: (template) => {
        template.title = 'Latest Paced Template'
        template.modifiedAt = '2026-07-24T11:30:00Z'
        template.templateText = 'Use the latest {{value}}.'
      }
    })

    const options = mutatePacedRevisionUpdateTransaction.mock.calls[0]?.[0]
    expect(options).toMatchObject({
      collectionId: 'prompt-templates',
      elementId: 'paced-template',
      debounceMs: 2000
    })

    /** Generic invoke spy captures the latest replacement command. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'inspect only' })
    await options.persistMutations({
      invoke,
      transaction: pacedTransaction
    })

    expect(invoke).toHaveBeenCalledWith('update-prompt-template', {
      payload: {
        command: {
          contentId: 'paced-template',
          title: 'Latest Paced Template',
          fallbackTitle: '',
          modifiedAt: '2026-07-24T11:30:00Z',
          templateText: 'Use the latest {{value}}.'
        },
        expectations: [
          {
            entityType: 'promptTemplate',
            id: 'paced-template',
            expected: 'revision',
            revision: 3
          }
        ]
      }
    })
  })

  it('creates a New Template through the domain mutation contract', async () => {
    const template = createPromptTemplateFull({
      id: 'new-template',
      title: '',
      fallbackTitle: '',
      createdAt: '',
      modifiedAt: '',
      templateText: ''
    })

    await createPromptTemplate('source-collection', template, null)

    const options = runRevisionMutation.mock.calls[0]?.[0]
    const insertedTemplates: object[] = []
    const insertedClientStates: object[] = []
    const sourceCollection = templateCollection('source-collection', ['paced-template'])
    options.mutateOptimistically({
      collections: {
        promptTemplate: { insert: (value: object) => insertedTemplates.push(value) },
        promptTemplateClientState: {
          insert: (value: object) => insertedClientStates.push(value)
        },
        promptCollection: {
          update: (
            _id: string,
            mutate: (draft: ReturnType<typeof templateCollection>) => void
          ) => mutate(sourceCollection)
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
    expect(sourceCollection.statusFolders.active.categoryOrder.categories[0]?.entries).toEqual([
      { kind: 'template', id: 'new-template' },
      { kind: 'template', id: 'paced-template' }
    ])

    /** Generic invoke spy captures the template command and absent insertion expectation. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'stop before commit' })
    await options.persistMutations({ invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('create-prompt-template', {
      payload: {
        command: {
          promptCollectionId: 'source-collection',
          contentId: 'new-template',
          title: '',
          fallbackTitle: '',
          templateText: '',
          createdAt: expect.any(String),
          categoryId: null,
          previousEntryId: null
        },
        expectations: [
          {
            entityType: 'promptCollection',
            id: 'source-collection',
            expected: 'revision',
            revision: 1
          },
          {
            entityType: 'promptTemplate',
            id: 'new-template',
            expected: 'absent'
          }
        ]
      }
    })
  })

  it('reconciles the latest template snapshot from a delete conflict', async () => {
    await deletePromptTemplate('source-collection', 'paced-template')
    const deleteOptions = runRevisionMutation.mock.calls[0]?.[0]

    deleteOptions.handleSuccessOrConflictResponse({
      snapshots: [
        {
          entityType: 'promptTemplate',
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
      ]
    })

    expect(promptTemplatesCollection.utils.getAuthoritativeRevision('paced-template')).toBe(4)
    expect(promptTemplatesCollection.get('paced-template')).toMatchObject({
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

  it('sends template deletion and location changes through their IPC channels', async () => {
    await deletePromptTemplate('source-collection', 'paced-template')
    const deleteOptions = runRevisionMutation.mock.calls[0]?.[0]
    const sourceAfterDelete = templateCollection('source-collection', ['paced-template'])
    const deleteTemplate = vi.fn()
    const deleteClientState = vi.fn()
    deleteOptions.mutateOptimistically({
      collections: {
        promptTemplate: { delete: deleteTemplate },
        promptTemplateClientState: { delete: deleteClientState },
        promptCollection: {
          update: (
            _id: string,
            mutate: (draft: ReturnType<typeof templateCollection>) => void
          ) => mutate(sourceAfterDelete)
        }
      }
    })
    expect(deleteTemplate).toHaveBeenCalledWith('paced-template')
    expect(deleteClientState).toHaveBeenCalledWith('paced-template')
    expect(sourceAfterDelete.statusFolders.active.categoryOrder.categories[0]?.entries).toEqual([])
    /** Generic delete invoke spy captures the workspace-scoped deletion command. */
    const deleteInvoke = vi.fn().mockResolvedValue({ success: false, error: 'stop before commit' })
    await deleteOptions.persistMutations({ invoke: deleteInvoke, transaction: {} })
    expect(deleteInvoke).toHaveBeenCalledWith('delete-prompt-template', {
      payload: {
        command: {
          workspaceId: 'template-workspace',
          promptCollectionId: 'source-collection',
          contentId: 'paced-template'
        },
        expectations: [
          {
            entityType: 'promptCollection',
            id: 'source-collection',
            expected: 'revision',
            revision: 1
          },
          {
            entityType: 'promptTemplate',
            id: 'paced-template',
            expected: 'revision',
            revision: 3
          }
        ]
      }
    })

    await setPromptLocation('source-collection', 'paced-template', {
      promptCollectionId: 'destination-collection',
      categoryId: null,
      previousEntryId: null,
      status: PromptTemplateStatus.Active
    })
    const moveOptions = runRevisionMutation.mock.calls[1]?.[0]
    const sourceAfterMove = templateCollection('source-collection', ['paced-template'])
    const destinationAfterMove = templateCollection('destination-collection')
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
        promptCollection: {
          update: (
            id: string,
            mutate: (draft: ReturnType<typeof templateCollection>) => void
          ) => mutate(id === 'source-collection' ? sourceAfterMove : destinationAfterMove)
        },
        promptTemplate: { update: updateTemplate },
        promptTemplateClientState: { update: updateClientState }
      }
    })
    expect(sourceAfterMove.statusFolders.active.categoryOrder.categories[0]?.entries).toEqual([])
    expect(destinationAfterMove.statusFolders.active.categoryOrder.categories[0]?.entries).toEqual([
      { kind: 'template', id: 'paced-template' }
    ])
    expect(updateTemplate).toHaveBeenCalledWith('paced-template', expect.any(Function))
    expect(updateClientState).toHaveBeenCalledWith('paced-template', expect.any(Function))
    expect(movedClientState.isEdited).toBe(true)
    /** Generic move invoke spy captures the template command and complete target set. */
    const moveInvoke = vi.fn().mockResolvedValue({ success: false, error: 'stop before commit' })
    await moveOptions.persistMutations({ invoke: moveInvoke, transaction: {} })
    expect(moveInvoke).toHaveBeenCalledWith('set-prompt-location', {
      payload: {
        command: {
          kind: 'template',
          sourcePromptCollectionId: 'source-collection',
          promptId: 'paced-template',
          location: { promptCollectionId: 'destination-collection', categoryId: null, previousEntryId: null, status: PromptTemplateStatus.Active },
          modifiedAt: expect.any(String)
        },
        expectations: [
          {
            entityType: 'promptCollection',
            id: 'source-collection',
            expected: 'revision',
            revision: 1
          },
          {
            entityType: 'promptCollection',
            id: 'destination-collection',
            expected: 'revision',
            revision: 1
          },
          {
            entityType: 'promptTemplate',
            id: 'paced-template',
            expected: 'revision',
            revision: 3
          }
        ]
      }
    })
  })
})
