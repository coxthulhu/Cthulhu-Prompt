import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import {
  mutatePacedRendererDomainMutation,
  runImmediateRendererDomainMutation
} from '@renderer/data/IpcFramework/RendererDomainMutation'
import { submitAllPacedUpdateTransactionsAndWait } from '@renderer/data/IpcFramework/RevisionCollections'
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

/** Applies one paced category rename through the generic renderer domain framework. */
const mutatePacedCategoryDomainMutation = (
  displayName: string,
  debounceMs: number,
  validateBeforeEnqueue?: () => boolean
): void =>
  mutatePacedRendererDomainMutation({
    mutation: { command: { displayName }, plan: planRenameCategory },
    ipc: { channel: 'test-renderer-domain-paced' },
    renderer: {
      mutate: ({ collections }) => {
        collections.promptClientState.update(CATEGORY_ID, (draft) => {
          draft.isEdited = true
        })
      },
      clientStateCollections: [promptClientStateCollection]
    },
    pacing: {
      target: { entityType: 'category', id: CATEGORY_ID },
      debounceMs,
      validateBeforeEnqueue
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

  afterEach(async () => {
    await submitAllPacedUpdateTransactionsAndWait()
    vi.useRealTimers()
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

  it('merges same-target paced edits, resets debounce, and persists only the latest command', async () => {
    vi.useFakeTimers()
    /** IPC invocation returning the authoritative value from the replacement command. */
    const invoke = vi.fn(
      async (_channel: string, request: { payload: { command: RenameTestCommand } }) =>
        createSuccessResponse(2, request.payload.command.displayName)
    )
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutatePacedCategoryDomainMutation('First paced value', 200)
    vi.advanceTimersByTime(150)
    mutatePacedCategoryDomainMutation('Latest paced value', 200)

    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Latest paced value')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(true)
    vi.advanceTimersByTime(199)
    await Promise.resolve()
    expect(invoke).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await submitAllPacedUpdateTransactionsAndWait()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith(
      'test-renderer-domain-paced',
      expect.objectContaining({
        payload: expect.objectContaining({
          command: { displayName: 'Latest paced value' },
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
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(true)
  })

  it('keeps an invalid paced domain mutation pending until its latest edit validates', async () => {
    vi.useFakeTimers()
    /** Current validation state read immediately before paced persistence enqueue. */
    let isValid = false
    /** IPC invocation used to prove invalid input is not persisted. */
    const invoke = vi.fn().mockResolvedValue(createSuccessResponse(2, 'Valid'))
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutatePacedCategoryDomainMutation('Invalid', 200, () => isValid)
    vi.advanceTimersByTime(200)
    await submitAllPacedUpdateTransactionsAndWait()
    expect(invoke).not.toHaveBeenCalled()

    isValid = true
    mutatePacedCategoryDomainMutation('Valid', 200, () => isValid)
    vi.advanceTimersByTime(200)
    await submitAllPacedUpdateTransactionsAndWait()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ command: { displayName: 'Valid' } })
      })
    )
  })

  it('rejects paced plans that do not modify exactly their declared target', () => {
    /** Empty plan violating the requirement that one authoritative entity be edited. */
    const planNoChanges: DomainPlanner<RenameTestCommand> = () => []
    /** Single change aimed at an entity other than the declared pacing target. */
    const planDifferentTarget: DomainPlanner<RenameTestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'category',
        id: 'different-category',
        recipe: (draft) => {
          draft.displayName = command.displayName
        }
      }
    ]
    /** Two-target plan violating the requirement that exactly one entity be edited. */
    const planMultipleTargets: DomainPlanner<RenameTestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'category',
        id: CATEGORY_ID,
        recipe: (draft) => {
          draft.displayName = command.displayName
        }
      },
      {
        type: 'update',
        entityType: 'category',
        id: 'additional-category',
        recipe: (draft) => {
          draft.displayName = command.displayName
        }
      }
    ]
    /** Shared mutation options used to exercise plan-target validation. */
    const createOptions = (plan: DomainPlanner<RenameTestCommand>) => ({
      mutation: { command: { displayName: 'Rejected' }, plan },
      ipc: { channel: 'test-renderer-domain-paced' },
      renderer: {},
      pacing: {
        target: { entityType: 'category' as const, id: CATEGORY_ID },
        debounceMs: 200
      }
    })

    expect(() => mutatePacedRendererDomainMutation(createOptions(planNoChanges))).toThrow(
      `Paced domain mutation must modify exactly its declared target category:${CATEGORY_ID}`
    )
    expect(() => mutatePacedRendererDomainMutation(createOptions(planDifferentTarget))).toThrow(
      `Paced domain mutation must modify exactly its declared target category:${CATEGORY_ID}`
    )
    expect(() => mutatePacedRendererDomainMutation(createOptions(planMultipleTargets))).toThrow(
      `Paced domain mutation must modify exactly its declared target category:${CATEGORY_ID}`
    )
  })

  it('flushes a matching paced domain mutation before an immediate domain mutation', async () => {
    /** Commands captured in their actual renderer persistence order. */
    const commands: RenameTestCommand[] = []
    /** IPC implementation producing sequential authoritative revisions. */
    const invoke = vi.fn(
      async (_channel: string, request: { payload: { command: RenameTestCommand } }) => {
        commands.push(request.payload.command)
        return createSuccessResponse(commands.length + 1, request.payload.command.displayName)
      }
    )
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutatePacedCategoryDomainMutation('Paced', 10_000)
    await runCategoryDomainMutation('Immediate')

    expect(commands).toEqual([{ displayName: 'Paced' }, { displayName: 'Immediate' }])
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Immediate')
  })

  it('applies paced conflict truth and rolls back merged renderer-only state', async () => {
    /** IPC conflict returning authoritative category truth. */
    const invoke = vi.fn().mockResolvedValue({
      success: false,
      conflict: true,
      payload: createSuccessResponse(2, 'Server').payload
    })
    vi.stubGlobal('window', {
      ipcClientId: 'renderer-domain-client',
      electron: { ipcRenderer: { invoke } }
    })

    mutatePacedCategoryDomainMutation('First optimistic', 10_000)
    mutatePacedCategoryDomainMutation('Latest optimistic', 10_000)
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Latest optimistic')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(true)

    await submitAllPacedUpdateTransactionsAndWait()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(categoryCollection.get(CATEGORY_ID)?.displayName).toBe('Server')
    expect(promptClientStateCollection.get(CATEGORY_ID)?.isEdited).toBe(false)
  })
})
