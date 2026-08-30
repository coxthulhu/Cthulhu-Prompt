import { beforeEach, describe, expect, it, vi } from 'vitest'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { promptFolderClientStateCollection } from '@renderer/data/Collections/PromptFolderClientStateCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'

/** Revision runner spy exposing root-folder domain mutation contracts. */
const runRevisionMutation = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({
  runRevisionMutation,
  mutatePacedRevisionUpdateTransaction: vi.fn(),
  submitPacedUpdateTransactionAndWait: vi.fn()
}))

import { createPromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
import { movePromptFolder } from '@renderer/data/Mutations/WorkspaceMutations'

/** Stable workspace used by root-folder mutation tests. */
const WORKSPACE_ID = 'root-mutation-workspace'
/** Existing root used as creation predecessor and reorder target. */
const EXISTING_ROOT_ID = 'root-mutation-existing'
/** Second existing root used by the reorder test. */
const SECOND_ROOT_ID = 'root-mutation-second'

/** Creates one prompt root with empty content. */
const createRootFolder = (id: string) => ({
  id,
  kind: 'prompt' as const,
  folderName: id,
  displayName: id,
  completedPromptIds: [],
  categoryOrder: { categories: [{ categoryId: null, entries: [] }] },
  settings: { folderDescription: null }
})

describe('root prompt-folder domain mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workspaceCollection.utils.deleteAuthoritative(WORKSPACE_ID)
    for (const id of [EXISTING_ROOT_ID, SECOND_ROOT_ID]) {
      promptFolderCollection.utils.deleteAuthoritative(id)
      if (promptFolderClientStateCollection.has(id)) {
        promptFolderClientStateCollection.delete(id)
      }
      promptFolderCollection.utils.upsertAuthoritative({
        id,
        revision: 1,
        data: createRootFolder(id)
      })
    }
    workspaceCollection.utils.upsertAuthoritative({
      id: WORKSPACE_ID,
      revision: 3,
      data: {
        id: WORKSPACE_ID,
        workspacePath: 'C:\\Workspace',
        workspaceName: 'Workspace',
        entries: [
          { kind: 'folder', id: EXISTING_ROOT_ID },
          { kind: 'folder', id: SECOND_ROOT_ID }
        ]
      }
    })
    runRevisionMutation.mockResolvedValue(undefined)
  })

  it('creates a root with local client state and an absent domain expectation', async () => {
    /** Stable ID returned by the renderer-authored creation command. */
    const createdId = await createPromptFolder(
      WORKSPACE_ID,
      ' Created Root ',
      EXISTING_ROOT_ID,
      'prompt'
    )
    /** Revision mutation options registered by root creation. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable workspace receiving the optimistic root insertion. */
    const workspace = structuredClone(workspaceCollection.get(WORKSPACE_ID)!)
    /** Optimistic root insertion spy. */
    const insertRoot = vi.fn()
    /** Optimistic client-state insertion spy. */
    const insertClientState = vi.fn()
    options.mutateOptimistically({
      collections: {
        workspace: {
          update: (_id: string, mutate: (draft: typeof workspace) => void) => mutate(workspace)
        },
        promptFolder: { insert: insertRoot },
        promptFolderClientState: { insert: insertClientState }
      }
    })
    expect(workspace.entries.map((entry) => entry.id)).toEqual([
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
    expect(invoke).toHaveBeenCalledWith('create-prompt-folder', {
      payload: {
        command: {
          workspaceId: WORKSPACE_ID,
          promptFolderId: createdId,
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
            entityType: 'promptFolder',
            id: createdId,
            expected: 'absent'
          }
        ]
      }
    })
  })

  it('reorders a root through one workspace domain target', async () => {
    await movePromptFolder(WORKSPACE_ID, SECOND_ROOT_ID, null)
    /** Revision mutation options registered by root reordering. */
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
    expect(workspace.entries.map((entry) => entry.id)).toEqual([
      SECOND_ROOT_ID,
      EXISTING_ROOT_ID
    ])

    /** Generic invoke spy captures the workspace-only expectation. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'inspect only' })
    await options.persistMutations({ invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('move-prompt-folder', {
      payload: {
        command: {
          workspaceId: WORKSPACE_ID,
          promptFolderId: SECOND_ROOT_ID,
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
