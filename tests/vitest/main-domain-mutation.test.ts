import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DomainMutationRequest, DomainPlanner } from '@shared/DomainChanges'
import type { IpcRequestWithPayload } from '@shared/IpcRequest'

/** Minimal committed entry accepted by mocked snapshot normalizers. */
type MockSnapshotEntry = { revision: number; committed: { id: string } }

/** Electron IPC registration spy used to invoke generic main handlers directly. */
const ipcHandle = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({ ipcMain: { handle: ipcHandle } }))

/** Hoisted committed-state registry used by main domain handler tests. */
const mockMainData = vi.hoisted(() => {
  /** Generic committed entry used by target and revision checks. */
  type Entry = { revision: number; committed: unknown; persistenceFields: unknown }
  /** Entity entries keyed by domain type. */
  const entries = {
    systemSettings: new Map<string, Entry>(),
    workspace: new Map<string, Entry>(),
    promptFolder: new Map<string, Entry>(),
    category: new Map<string, Entry>(),
    prompt: new Map<string, Entry>(),
    promptTemplate: new Map<string, Entry>()
  }
  /** Creates committed reads required by the generic main framework. */
  const createStore = (entityType: keyof typeof entries) => ({
    getEntry: (id: string) => entries[entityType].get(id) ?? null,
    getAllEntries: () => [...entries[entityType].values()]
  })
  /** Mock main data registry. */
  const data = {
    systemSettings: { committedStore: createStore('systemSettings') },
    workspace: { committedStore: createStore('workspace') },
    promptFolder: { committedStore: createStore('promptFolder') },
    category: { committedStore: createStore('category') },
    prompt: { committedStore: createStore('prompt') },
    promptTemplate: { committedStore: createStore('promptTemplate') }
  }
  /** Clears all committed entries between handler tests. */
  const reset = (): void => {
    for (const store of Object.values(entries)) store.clear()
  }
  return { data, entries, reset }
})

vi.mock('../../src/main/Data/Data', () => ({ data: mockMainData.data }))

/** Atomic operation spies used to execute and inspect the real framework builder callback. */
const atomicOperations = vi.hoisted(() => ({
  create: vi.fn(() => ({ operationIndex: 0, store: 'category', id: 'created' })),
  update: vi.fn(() => ({ operationIndex: 0, store: 'promptFolder', id: 'root' })),
  updatePersistenceFields: vi.fn(() => ({
    operationIndex: 1,
    store: 'category',
    id: 'filename-only'
  })),
  delete: vi.fn(() => ({ operationIndex: 0, store: 'category', id: 'deleted' }))
}))

/** Immediate atomic transaction spy that invokes the production operation builder. */
const runAtomicDataTransaction = vi.hoisted(() =>
  vi.fn(async (buildTransaction: (tx: unknown) => unknown) => {
    /** Store builder shared by test-only entity types. */
    const storeBuilder = atomicOperations
    /** Complete atomic builder shape consumed through production dynamic dispatch. */
    const tx = {
      systemSettings: storeBuilder,
      workspace: storeBuilder,
      promptFolder: storeBuilder,
      category: storeBuilder,
      prompt: storeBuilder,
      promptTemplate: storeBuilder
    }
    buildTransaction(tx)
    return { status: 'success', results: {} }
  })
)

vi.mock('../../src/main/Data/AtomicDataTransaction', () => ({ runAtomicDataTransaction }))
vi.mock('../../src/main/Data/GlobalMutationQueue', () => ({
  enqueueGlobalMutation: async <TResult>(mutation: () => Promise<TResult>) => await mutation()
}))

/** Persistence planning spy isolates main target/revision behavior. */
const planDomainPersistenceChanges = vi.hoisted(() => vi.fn(() => []))

vi.mock('../../src/main/Persistence/DomainPersistence', () => ({
  planDomainPersistenceChanges
}))

vi.mock('../../src/main/Data/DataSnapshotHelpers', () => ({
  buildWorkspaceSnapshot: (entry: MockSnapshotEntry) => ({
    id: entry.committed.id,
    revision: entry.revision,
    data: entry.committed
  }),
  buildPromptFolderSnapshot: (entry: MockSnapshotEntry) => ({
    id: entry.committed.id,
    revision: entry.revision,
    data: entry.committed
  }),
  buildCategorySnapshot: (entry: MockSnapshotEntry) => ({
    id: entry.committed.id,
    revision: entry.revision,
    data: entry.committed
  }),
  buildPromptSnapshot: (entry: MockSnapshotEntry) => ({
    id: entry.committed.id,
    revision: entry.revision,
    data: entry.committed
  }),
  buildPromptTemplateSnapshot: (entry: MockSnapshotEntry) => ({
    id: entry.committed.id,
    revision: entry.revision,
    data: entry.committed
  })
}))

import { handleMainDomainMutation } from '../../src/main/Mutations/DomainMutation'

/** Minimal command used by generic handler tests. */
type TestCommand = { folderId: string }

/** Response subset inspected by generic handler tests. */
type TestHandlerResponse = {
  success: boolean
  conflict?: boolean
  payload: { snapshots: Array<Record<string, unknown>> }
}

/** Root prompt-folder record used by handler snapshots. */
const promptFolder = {
  id: 'root',
  kind: 'prompt' as const,
  folderName: 'Root',
  displayName: 'Root',
  completedPromptIds: [],
  categoryOrder: { categories: [{ categoryId: null, entries: [] }] },
  settings: { folderDescription: null }
}

/** Registers a handler and returns the Electron callback captured by the spy. */
const registerHandler = (planner: DomainPlanner<TestCommand>) => {
  handleMainDomainMutation({
    ipc: {
      channel: 'test-domain-mutation',
      parseRequest: (request) => ({
        success: true,
        value: request as IpcRequestWithPayload<DomainMutationRequest<TestCommand>>
      })
    },
    mutation: planner
  })
  return ipcHandle.mock.calls[0]![1] as (
    _event: unknown,
    request: unknown
  ) => Promise<TestHandlerResponse>
}

describe('main domain mutation framework', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMainData.reset()
    mockMainData.entries.promptFolder.set('root', {
      revision: 4,
      committed: promptFolder,
      persistenceFields: {}
    })
  })

  it('returns the main-computed target set when renderer targets differ', async () => {
    /** Planner whose correct target set contains the root folder. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptFolder',
        id: command.folderId,
        recipe: (draft) => {
          draft.displayName = 'Changed'
        }
      }
    ]
    /** Registered Electron handler callback. */
    const handler = registerHandler(planner)
    /** Conflict response for an empty renderer target set. */
    const result = await handler(null, {
      requestId: 'request',
      clientId: 'client',
      payload: { command: { folderId: 'root' }, expectations: [] }
    })
    expect(result).toMatchObject({
      success: false,
      conflict: true,
      payload: {
        snapshots: [
          { entityType: 'promptFolder', id: 'root', revision: 4, data: promptFolder }
        ]
      }
    })
    expect(runAtomicDataTransaction).not.toHaveBeenCalled()
  })

  it('returns planner conflict targets with authoritative deleted snapshots', async () => {
    /** Planner conflict naming the correct missing category target. */
    const planner: DomainPlanner<TestCommand> = () => ({
      status: 'conflict',
      reason: 'Category ownership conflict',
      targets: [{ entityType: 'category', id: 'missing' }]
    })
    /** Conflict response returned through the registered Electron callback. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: { command: { folderId: 'root' }, expectations: [] }
    })
    expect(result.payload.snapshots).toEqual([
      { entityType: 'category', id: 'missing', deleted: true }
    ])
    expect(runAtomicDataTransaction).not.toHaveBeenCalled()
  })

  it('returns authoritative snapshots without committing for a stale revision', async () => {
    /** Valid folder planner whose renderer revision is stale. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptFolder',
        id: command.folderId,
        recipe: (draft) => {
          draft.displayName = 'Changed'
        }
      }
    ]
    /** Stale-revision conflict response. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: {
        command: { folderId: 'root' },
        expectations: [
          {
            entityType: 'promptFolder',
            id: 'root',
            expected: 'revision',
            revision: 3
          }
        ]
      }
    })
    expect(result).toMatchObject({
      success: false,
      conflict: true,
      payload: { snapshots: [{ entityType: 'promptFolder', id: 'root', revision: 4 }] }
    })
    expect(planDomainPersistenceChanges).not.toHaveBeenCalled()
    expect(runAtomicDataTransaction).not.toHaveBeenCalled()
  })

  it('returns authoritative snapshots when a renderer expects a present target to be absent', async () => {
    /** Valid folder planner whose renderer incorrectly expects insertion. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptFolder',
        id: command.folderId,
        recipe: (draft) => {
          draft.displayName = 'Changed'
        }
      }
    ]
    /** Present-versus-absent conflict response. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: {
        command: { folderId: 'root' },
        expectations: [
          {
            entityType: 'promptFolder',
            id: 'root',
            expected: 'absent'
          }
        ]
      }
    })
    expect(result.payload.snapshots).toEqual([
      { entityType: 'promptFolder', id: 'root', revision: 4, data: promptFolder }
    ])
    expect(runAtomicDataTransaction).not.toHaveBeenCalled()
  })

  it('plans persistence and uses immediate atomic mode after revision validation', async () => {
    /** Valid folder update planner. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptFolder',
        id: command.folderId,
        recipe: (draft) => {
          draft.displayName = 'Changed'
        }
      }
    ]
    /** Target persistence write plus one filename-only category adjustment. */
    planDomainPersistenceChanges.mockReturnValue([
      {
        type: 'upsert',
        entityType: 'promptFolder',
        id: 'root',
        data: promptFolder,
        persistenceFields: { folderPath: 'Root' }
      },
      {
        type: 'upsert',
        entityType: 'category',
        id: 'filename-only',
        data: { id: 'filename-only', displayName: 'Name', description: null },
        persistenceFields: { categoryStem: 'Name' }
      }
    ])
    /** Successful handler response after matching target and revision validation. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: {
        command: { folderId: 'root' },
        expectations: [
          {
            entityType: 'promptFolder',
            id: 'root',
            expected: 'revision',
            revision: 4
          }
        ]
      }
    })
    expect(result.success).toBe(true)
    expect(planDomainPersistenceChanges).toHaveBeenCalledOnce()
    expect(runAtomicDataTransaction).toHaveBeenCalledWith(expect.any(Function), {
      mode: 'immediate'
    })
    expect(atomicOperations.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'root', expectedRevision: 4 })
    )
    expect(atomicOperations.updatePersistenceFields).toHaveBeenCalledWith({
      id: 'filename-only',
      persistenceFields: { categoryStem: 'Name' }
    })
    expect(result.payload.snapshots).toEqual([
      { entityType: 'promptFolder', id: 'root', revision: 4, data: promptFolder }
    ])
  })
})
