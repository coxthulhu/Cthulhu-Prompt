import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromptSummary, PromptStatus, PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { createPromptStatusFolderLayouts } from '@shared/domain/prompt-collection/PromptCollection'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'

/** Revision runner spy exposing optimistic prompt mutation contracts. */
const runRevisionMutation = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({
  runRevisionMutation,
  mutatePacedRevisionUpdateTransaction: vi.fn(),
  submitPacedUpdateTransactionAndWait: vi.fn()
}))

import { setPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'

/** Stable prompt used by move and status mutation tests. */
const PROMPT_ID = 'prompt-mutation-test'
/** Stable source collection used by move and status mutation tests. */
const SOURCE_COLLECTION_ID = 'prompt-mutation-source'
/** Stable destination collection used by cross-root move tests. */
const DESTINATION_COLLECTION_ID = 'prompt-mutation-destination'
/** Stable destination category proving canonical summary metadata is updated. */
const DESTINATION_CATEGORY_ID = 'prompt-mutation-category'

/** Creates one prompt-collection record with the requested active prompts. */
const promptCollection = (
  id: string,
  promptIds: string[] = [],
  categoryId: string | null = null
) => ({
  id,
  kind: 'prompt' as const,
  folderName: id,
  displayName: id,
  statusFolders: createPromptStatusFolderLayouts({
    categoryOrders: {
      [PromptStatusFolderId.Active]: {
        categories: [
          {
            categoryId: null,
            entries: promptIds.map((promptId) => ({ kind: 'prompt' as const, id: promptId }))
          },
          ...(categoryId === null ? [] : [{ categoryId, entries: [] }])
        ]
      }
    }
  }),
  settings: { collectionDescription: null }
})

describe('prompt mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    promptsCollection.utils.deleteAuthoritative(PROMPT_ID)
    promptCollectionsCollection.utils.deleteAuthoritative(SOURCE_COLLECTION_ID)
    promptCollectionsCollection.utils.deleteAuthoritative(DESTINATION_COLLECTION_ID)
    if (promptClientStateCollection.has(PROMPT_ID)) promptClientStateCollection.delete(PROMPT_ID)

    promptsCollection.utils.upsertAuthoritative({
      id: PROMPT_ID,
      revision: 3,
      data: createPromptSummary({
        id: PROMPT_ID,
        title: 'Prompt',
        fallbackTitle: '',
        modifiedAt: '2026-08-28T11:00:00.000Z',
        status: PromptStatus.Todo
      })
    })
    promptClientStateCollection.insert({ id: PROMPT_ID, isEdited: false })
    promptCollectionsCollection.utils.upsertAuthoritative({
      id: SOURCE_COLLECTION_ID,
      revision: 2,
      data: promptCollection(SOURCE_COLLECTION_ID, [PROMPT_ID])
    })
    promptCollectionsCollection.utils.upsertAuthoritative({
      id: DESTINATION_COLLECTION_ID,
      revision: 4,
      data: promptCollection(DESTINATION_COLLECTION_ID, [], DESTINATION_CATEGORY_ID)
    })
    runRevisionMutation.mockResolvedValue(undefined)
  })

  it('moves canonical prompt state while sending only its revision reference', async () => {
    await setPromptLocation(SOURCE_COLLECTION_ID, PROMPT_ID, {
      promptCollectionId: DESTINATION_COLLECTION_ID,
      categoryId: DESTINATION_CATEGORY_ID,
      previousEntryId: null,
      status: PromptStatus.Todo
    })

    /** Revision mutation options registered by the prompt move. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable source collection receiving the optimistic removal. */
    const source = promptCollection(SOURCE_COLLECTION_ID, [PROMPT_ID])
    /** Mutable destination collection receiving the optimistic insertion. */
    const destination = promptCollection(DESTINATION_COLLECTION_ID, [], DESTINATION_CATEGORY_ID)
    /** Mutable canonical prompt receiving move-owned metadata. */
    const prompt = structuredClone(promptsCollection.get(PROMPT_ID)!)
    /** Prompt client state receiving the edited latch. */
    const promptClientState = { id: PROMPT_ID, isEdited: false }

    options.mutateOptimistically({
      collections: {
        promptCollection: {
          update: (id: string, update: (draft: typeof source) => void) =>
            update(id === SOURCE_COLLECTION_ID ? source : destination)
        },
        prompt: {
          update: (_id: string, update: (draft: typeof prompt) => void) => update(prompt)
        },
        promptClientState: {
          update: (_id: string, update: (clientState: typeof promptClientState) => void) =>
            update(promptClientState)
        }
      }
    })

    expect(
      source.statusFolders[PromptStatusFolderId.Active].categoryOrder.categories[0]?.entries
    ).toEqual([])
    expect(
      destination.statusFolders[PromptStatusFolderId.Active].categoryOrder.categories[1]
        ?.entries
    ).toEqual([
      { kind: 'prompt', id: PROMPT_ID }
    ])
    expect(prompt.category).toBe(DESTINATION_CATEGORY_ID)
    expect(promptClientState).toEqual({ id: PROMPT_ID, isEdited: true })

    /** Generic invoke spy captures the command and automatically derived target revisions. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'stop before commit' })
    await options.persistMutations({ invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('set-prompt-location', {
      payload: {
        command: {
          kind: 'prompt',
          sourcePromptCollectionId: SOURCE_COLLECTION_ID,
          promptId: PROMPT_ID,
          location: { promptCollectionId: DESTINATION_COLLECTION_ID, categoryId: DESTINATION_CATEGORY_ID, previousEntryId: null, status: PromptStatus.Todo },
          modifiedAt: expect.any(String)
        },
        expectations: [
          {
            entityType: 'promptCollection',
            id: SOURCE_COLLECTION_ID,
            expected: 'revision',
            revision: 2
          },
          {
            entityType: 'promptCollection',
            id: DESTINATION_COLLECTION_ID,
            expected: 'revision',
            revision: 4
          },
          {
            entityType: 'prompt',
            id: PROMPT_ID,
            expected: 'revision',
            revision: 3
          }
        ]
      }
    })
  })

  it('transfers canonical prompt status across roots while latching the edited marker', async () => {
    await setPromptLocation(SOURCE_COLLECTION_ID, PROMPT_ID, {
      promptCollectionId: DESTINATION_COLLECTION_ID,
      categoryId: null,
      previousEntryId: null,
      status: PromptStatus.Completed
    })

    /** Revision mutation options registered by the prompt status change. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable source root losing active ownership. */
    const source = promptCollection(SOURCE_COLLECTION_ID, [PROMPT_ID])
    /** Mutable destination root receiving completed ownership. */
    const destination = promptCollection(DESTINATION_COLLECTION_ID, [], DESTINATION_CATEGORY_ID)
    /** Mutable canonical prompt receiving status fields. */
    const prompt = structuredClone(promptsCollection.get(PROMPT_ID)!)
    /** Prompt client state receiving the edited latch. */
    const promptClientState = { id: PROMPT_ID, isEdited: false }

    options.mutateOptimistically({
      collections: {
        promptCollection: {
          update: (id: string, update: (draft: typeof source) => void) =>
            update(id === SOURCE_COLLECTION_ID ? source : destination)
        },
        prompt: {
          update: (_id: string, update: (draft: typeof prompt) => void) => update(prompt)
        },
        promptClientState: {
          update: (_id: string, update: (clientState: typeof promptClientState) => void) =>
            update(promptClientState)
        }
      }
    })

    expect(prompt.status).toBe(PromptStatus.Completed)
    expect(prompt).toHaveProperty('finalizedAt')
    expect(
      source.statusFolders[PromptStatusFolderId.Active].categoryOrder.categories[0]
        ?.entries
    ).toEqual([])
    expect(destination.statusFolders[PromptStatusFolderId.Completed].promptIds).toEqual([
      PROMPT_ID
    ])
    expect(promptClientState).toEqual({ id: PROMPT_ID, isEdited: true })

    /** Generic invoke spy captures the status command and derived revisions. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'stop before commit' })
    await options.persistMutations({ invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('set-prompt-location', {
      payload: {
        command: {
          kind: 'prompt',
          sourcePromptCollectionId: SOURCE_COLLECTION_ID,
          promptId: PROMPT_ID,
          location: { promptCollectionId: DESTINATION_COLLECTION_ID, categoryId: null, previousEntryId: null, status: PromptStatus.Completed },
          modifiedAt: prompt.modifiedAt
        },
        expectations: [
          {
            entityType: 'promptCollection',
            id: SOURCE_COLLECTION_ID,
            expected: 'revision',
            revision: 2
          },
          {
            entityType: 'promptCollection',
            id: DESTINATION_COLLECTION_ID,
            expected: 'revision',
            revision: 4
          },
          {
            entityType: 'prompt',
            id: PROMPT_ID,
            expected: 'revision',
            revision: 3
          }
        ]
      }
    })
  })
})
