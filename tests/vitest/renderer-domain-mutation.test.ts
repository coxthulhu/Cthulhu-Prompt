import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'
import type {
  DomainExpectedTargetSelector,
  DomainPlanner
} from '@shared/DomainChanges'

/** Stable category and local-state ID used by executable renderer framework tests. */
const CATEGORY_ID = 'renderer-domain-framework'

/** Command that assigns one category display name. */
type RenameTestCommand = { displayName: string }

/** Shared test planner producing one recipe-based category update. */
const planRenameCategory: DomainPlanner<RenameTestCommand> = (_state, command) => [
  {
    type: 'update',
    entityType: 'category',
    id: CATEGORY_ID,
    recipe: (draft) => {
      draft.displayName = command.displayName
    }
  }
]

/** Creates one generic successful category snapshot response. */
const createSuccessResponse = (revision: number, displayName: string) => ({
  success: true as const,
  payload: {
    snapshots: [
      {
        entityType: 'category' as const,
        id: CATEGORY_ID,
        revision,
        data: { id: CATEGORY_ID, displayName, description: null }
      }
    ]
  }
})

/** Runs one category mutation with a renderer-only edited-state change. */
const runCategoryDomainMutation = async (
  displayName: string,
  selectExpectedTargets?: DomainExpectedTargetSelector
): Promise<void> =>
  await runImmediateRendererDomainMutation({
    mutation: { command: { displayName }, plan: planRenameCategory, selectExpectedTargets },
    ipc: { channel: 'test-renderer-domain' },
    renderer: {
      mutate: ({ collections }) => {
        collections.promptClientState.update(CATEGORY_ID, (draft) => {
          draft.isEdited = true
        })
      },
      clientStateCollections: [promptClientStateCollection]
    }
  })

describe('renderer domain mutation framework', () => {
  beforeEach(() => {
    categoryCollection.utils.deleteAuthoritative(CATEGORY_ID)
    if (promptClientStateCollection.has(CATEGORY_ID)) {
      promptClientStateCollection.delete(CATEGORY_ID)
    }
    categoryCollection.utils.upsertAuthoritative({
      id: CATEGORY_ID,
      revision: 1,
      data: { id: CATEGORY_ID, displayName: 'Initial', description: null }
    })
    promptClientStateCollection.insert({ id: CATEGORY_ID, isEdited: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts renderer-only state after success and sends current target revisions', async () => {
    /** IPC invoke spy returning authoritative success. */
    const invoke = vi.fn().mockResolvedValue(createSuccessResponse(2, 'Successful'))
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await runCategoryDomainMutation('Successful')

    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Successful')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(true)
    expect(invoke).toHaveBeenCalledWith(
      'test-renderer-domain',
      expect.objectContaining({
        payload: expect.objectContaining({
          expectations: [
            {
              entityType: 'category',
              id: CATEGORY_ID,
              expected: 'revision',
              revision: 1
            }
          ]
        })
      })
    )
  })

  it('applies conflict truth and rolls back renderer-only state', async () => {
    /** IPC invoke spy returning authoritative conflict truth. */
    const invoke = vi.fn().mockResolvedValue({
      success: false,
      conflict: true,
      payload: createSuccessResponse(2, 'Server').payload
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await expect(runCategoryDomainMutation('Optimistic')).rejects.toThrow(
      'Domain mutation conflict on test-renderer-domain'
    )
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Server')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(false)
  })

  it('captures expectations after earlier queued mutations settle', async () => {
    /** Resolver that holds the first IPC response while a second mutation is queued. */
    let releaseFirstResponse: (() => void) | undefined
    /** Promise gate controlling the first queued IPC response. */
    const firstResponseGate = new Promise<void>((resolve) => {
      releaseFirstResponse = resolve
    })
    /** Captured domain request payloads in actual IPC send order. */
    const requests: Array<{ payload: { expectations: Array<{ revision: number }> } }> = []
    /** IPC implementation returning monotonically revised authoritative snapshots. */
    const invoke = vi.fn(async (_channel: string, request: typeof requests[number]) => {
      requests.push(request)
      if (requests.length === 1) {
        await firstResponseGate
        return createSuccessResponse(2, 'First')
      }
      return createSuccessResponse(3, 'Second')
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    /** First immediate mutation currently holding the renderer global queue. */
    const firstMutation = runCategoryDomainMutation('First')
    /** Second immediate mutation queued while the first IPC response is pending. */
    const secondMutation = runCategoryDomainMutation('Second')
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    releaseFirstResponse?.()
    await Promise.all([firstMutation, secondMutation])

    expect(requests.map((request) => request.payload.expectations[0]!.revision)).toEqual([1, 2])
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Second')
  })

  it('uses the registration selector to omit unchecked targets', async () => {
    /** IPC invocation used to inspect the registration-selected expectation set. */
    const invoke = vi.fn().mockResolvedValue(createSuccessResponse(2, 'Unchecked'))
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    await runCategoryDomainMutation('Unchecked', () => [])

    expect(invoke).toHaveBeenCalledWith(
      'test-renderer-domain',
      expect.objectContaining({
        payload: expect.objectContaining({ expectations: [] })
      })
    )
  })
})
