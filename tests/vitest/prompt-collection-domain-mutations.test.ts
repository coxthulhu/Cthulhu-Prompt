import { beforeEach, describe, expect, it, vi } from 'vitest'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { promptCollectionClientStateCollection } from '@renderer/data/Collections/PromptCollectionClientStateCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { createPromptStatusFolderLayouts } from '@shared/domain/prompt-collection/PromptCollection'

/** Revision runner spy exposing collection domain mutation contracts. */
const runRevisionMutation = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({
  runRevisionMutation,
  mutatePacedRevisionUpdateTransaction: vi.fn(),
  submitPacedUpdateTransactionAndWait: vi.fn()
}))

import { createPromptCollection } from '@renderer/data/Mutations/PromptCollectionMutations'
import { movePromptCollection } from '@renderer/data/Mutations/WorkspaceMutations'

/** Stable workspace used by collection mutation tests. */
const WORKSPACE_ID = 'root-mutation-workspace'
/** Existing collection used as creation predecessor and reorder target. */
const EXISTING_ROOT_ID = 'root-mutation-existing'
/** Second existing collection used by the reorder test. */
const SECOND_ROOT_ID = 'root-mutation-second'

/** Creates one prompt collection with empty content. */
const createCollection = (id: string) => ({
  id,
  kind: 'prompt' as const,
  folderName: id,
  displayName: id,
  statusFolders: createPromptStatusFolderLayouts({
    categoryOrders: {
      [PromptStatusFolderId.Active]: { categories: [{ categoryId: null, entries: [] }] }
    }
  }),
  settings: { collectionDescription: null }
})

describe('prompt-collection domain mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workspaceCollection.utils.deleteAuthoritative(WORKSPACE_ID)
    for (const id of [EXISTING_ROOT_ID, SECOND_ROOT_ID]) {
      promptCollectionsCollection.utils.deleteAuthoritative(id)
      if (promptCollectionClientStateCollection.has(id)) {
        promptCollectionClientStateCollection.delete(id)
      }
      promptCollectionsCollection.utils.upsertAuthoritative({
        id,
        revision: 1,
        data: createCollection(id)
      })
    }
    workspaceCollection.utils.upsertAuthoritative({
      id: WORKSPACE_ID,
      revision: 3,
      data: {
        id: WORKSPACE_ID,
        workspacePath: 'C:\\Workspace',
        workspaceName: 'Workspace',
        promptCollectionEntries: [
          { kind: 'collection', id: EXISTING_ROOT_ID },
          { kind: 'collection', id: SECOND_ROOT_ID }
        ],
        templateCollectionEntries: []
      }
    })
    runRevisionMutation.mockResolvedValue(undefined)
  })

  it('creates a root with local client state and an absent domain expectation', async () => {
    /** Stable ID returned by the renderer-authored creation command. */
    const createdId = await createPromptCollection(
      WORKSPACE_ID,
      ' Created Root ',
      EXISTING_ROOT_ID,
      'prompt'
    )
    /** Revision mutation options registered by collection creation. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable workspace receiving the optimistic collection insertion. */
    const workspace = structuredClone(workspaceCollection.get(WORKSPACE_ID)!)
    /** Optimistic collection insertion spy. */
    const insertRoot = vi.fn()
    /** Optimistic client-state insertion spy. */
    const insertClientState = vi.fn()
    options.mutateOptimistically({
      collections: {
        workspace: {
          update: (_id: string, mutate: (draft: typeof workspace) => void) => mutate(workspace)
        },
        promptCollection: { insert: insertRoot },
        promptCollectionClientState: { insert: insertClientState }
      }
    })
    expect(workspace.promptCollectionEntries.map((entry) => entry.id)).toEqual([
      EXISTING_ROOT_ID,
      createdId,
      SECOND_ROOT_ID
    ])
    expect(insertRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        id: createdId,
        displayName: 'Created Root',
        folderName: 'CreatedRoot'
      })
    )
    expect(insertClientState).toHaveBeenCalledWith({
      id: createdId,
      hasLoadedInitialData: false
    })

    /** Generic invoke spy captures creation intent and expected revisions. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'inspect only' })
    await options.persistMutations({ invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('create-prompt-collection', {
      payload: {
        command: {
          workspaceId: WORKSPACE_ID,
          promptCollectionId: createdId,
          displayName: ' Created Root ',
          previousEntryId: EXISTING_ROOT_ID,
          kind: 'prompt'
        },
        expectations: [
          {
            entityType: 'workspace',
            id: WORKSPACE_ID,
            expected: 'revision',
            revision: 3
          },
          {
            entityType: 'promptCollection',
            id: createdId,
            expected: 'absent'
          }
        ]
      }
    })
  })

  it('reorders a root through one workspace domain target', async () => {
    await movePromptCollection(WORKSPACE_ID, SECOND_ROOT_ID, null)
    /** Revision mutation options registered by collection reordering. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable workspace receiving the optimistic reorder. */
    const workspace = structuredClone(workspaceCollection.get(WORKSPACE_ID)!)
    options.mutateOptimistically({
      collections: {
        workspace: {
          update: (_id: string, mutate: (draft: typeof workspace) => void) => mutate(workspace)
        }
      }
    })
    expect(workspace.promptCollectionEntries.map((entry) => entry.id)).toEqual([
      SECOND_ROOT_ID,
      EXISTING_ROOT_ID
    ])

    /** Generic invoke spy captures the workspace-only expectation. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'inspect only' })
    await options.persistMutations({ invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('move-prompt-collection', {
      payload: {
        command: {
          workspaceId: WORKSPACE_ID,
          promptCollectionId: SECOND_ROOT_ID,
          previousEntryId: null
        },
        expectations: [
          {
            entityType: 'workspace',
            id: WORKSPACE_ID,
            expected: 'revision',
            revision: 3
          }
        ]
      }
    })
  })
})
