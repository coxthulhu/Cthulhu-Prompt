import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DomainCommandParser,
  DomainExpectedTargetSelector,
  DomainPlanner
} from '@shared/DomainChanges'

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
  error?: string
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

/** Strict runtime parser supplied by the test mutation definition. */
const parseTestCommand: DomainCommandParser<TestCommand> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw test command fields validated as an exact object. */
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 1 && typeof record.folderId === 'string'
    ? { folderId: record.folderId }
    : null
}

/** Registers a handler and returns the Electron callback captured by the spy. */
const registerHandler = (
  planner: DomainPlanner<TestCommand>,
  selectExpectedTargets?: DomainExpectedTargetSelector
) => {
  handleMainDomainMutation({
    ipc: { channel: 'test-domain-mutation' },
    mutation: {
      parseCommand: parseTestCommand,
      plan: planner,
      selectExpectedTargets
    }
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

  it('rejects malformed commands through the mutation-specific parser', async () => {
    /** Planner spy that must not receive an invalid command. */
    const planner = vi.fn<DomainPlanner<TestCommand>>(() => [])
    /** Invalid request carrying an extra command property. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: {
        command: { folderId: 'root', extra: true },
        expectations: []
      }
    })
    expect(result).toMatchObject({ success: false, error: 'Invalid request payload' })
    expect(planner).not.toHaveBeenCalled()
  })

  it('rejects malformed revision expectations in the generic domain envelope', async () => {
    /** Planner spy that must not receive invalid generic expectations. */
    const planner = vi.fn<DomainPlanner<TestCommand>>(() => [])
    /** Invalid request whose revision expectation omits its revision. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: {
        command: { folderId: 'root' },
        expectations: [
          { entityType: 'promptFolder', id: 'root', expected: 'revision' }
        ]
      }
    })
    expect(result).toMatchObject({ success: false, error: 'Invalid request payload' })
    expect(planner).not.toHaveBeenCalled()
  })

  it('rejects extra fields on both generic revision expectation variants', async () => {
    /** Planner spy that must not receive expectations with legacy fields. */
    const planner = vi.fn<DomainPlanner<TestCommand>>(() => [])
    /** Registered handler used to validate both discriminated expectation shapes. */
    const handler = registerHandler(planner)
    /** Invalid absent expectation carrying the revision field reserved for present targets. */
    const absentResult = await handler(null, {
      requestId: 'absent-request',
      clientId: 'client',
      payload: {
        command: { folderId: 'root' },
        expectations: [
          {
            entityType: 'promptFolder',
            id: 'root',
            expected: 'absent',
            revision: 0
          }
        ]
      }
    })
    /** Invalid revision expectation carrying legacy full entity data. */
    const revisionResult = await handler(null, {
      requestId: 'revision-request',
      clientId: 'client',
      payload: {
        command: { folderId: 'root' },
        expectations: [
          {
            entityType: 'promptFolder',
            id: 'root',
            expected: 'revision',
            revision: 4,
            data: { id: 'root' }
          }
        ]
      }
    })
    expect(absentResult).toMatchObject({ success: false, error: 'Invalid request payload' })
    expect(revisionResult).toMatchObject({ success: false, error: 'Invalid request payload' })
    expect(planner).not.toHaveBeenCalled()
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

  it('uses the registration selector for the required expectation target set', async () => {
    mockMainData.entries.category.set('unchecked-category', {
      revision: 7,
      committed: {
        id: 'unchecked-category',
        displayName: 'Unchecked',
        description: null
      },
      persistenceFields: {}
    })
    /** Planner containing one revision-checked folder update and one unchecked child deletion. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptFolder',
        id: command.folderId,
        recipe: (draft) => {
          draft.displayName = 'Changed'
        }
      },
      {
        type: 'delete',
        entityType: 'category',
        id: 'unchecked-category'
      }
    ]
    /** Target persistence writes required by both planned atomic operations. */
    planDomainPersistenceChanges.mockReturnValue([
      {
        type: 'upsert',
        entityType: 'promptFolder',
        id: 'root',
        data: promptFolder,
        persistenceFields: {}
      },
      {
        type: 'remove',
        entityType: 'category',
        id: 'unchecked-category',
        persistenceFields: {}
      }
    ])
    /** Registration selector retaining only workspace-like root ownership checks. */
    const selectExpectedTargets: DomainExpectedTargetSelector = (changes) =>
      changes.filter((change) => change.entityType === 'promptFolder')
    /** Successful request omitting the category's current revision. */
    const result = await registerHandler(planner, selectExpectedTargets)(null, {
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
    expect(atomicOperations.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'root', expectedRevision: 4 })
    )
    expect(atomicOperations.delete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'unchecked-category', expectedRevision: undefined })
    )
    expect(
      result.payload.snapshots.map((snapshot) => `${snapshot.entityType}:${snapshot.id}`)
    ).toEqual(['promptFolder:root', 'category:unchecked-category'])
  })
})
