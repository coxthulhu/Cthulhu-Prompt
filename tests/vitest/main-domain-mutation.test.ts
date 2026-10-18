import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DomainCommandParser,
  DomainPlanner
} from '@shared/domain/DomainChanges'
import { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { createPromptStatusFolderLayouts } from '@shared/domain/prompt-collection/PromptCollection'

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
    promptCollection: new Map<string, Entry>(),
    category: new Map<string, Entry>(),
    prompt: new Map<string, Entry>(),
    note: new Map<string, Entry>(),
    promptTemplate: new Map<string, Entry>(),
    workspacePromptCollectionUiState: new Map<string, Entry>()
  }
  /** Creates committed reads required by the generic main framework. */
  const createStore = (entityType: keyof typeof entries) => ({
    getEntry: (id: string) => entries[entityType].get(id) ?? null,
    getAllEntries: () => [...entries[entityType].values()]
  })
  /** Mock main data registry. */
  const data = {
    systemSettings: { committedStore: createStore('systemSettings'), targetPolicy: 'requirePresent' },
    workspace: { committedStore: createStore('workspace'), targetPolicy: 'requirePresent' },
    promptCollection: { committedStore: createStore('promptCollection'), targetPolicy: 'requirePresent' },
    category: { committedStore: createStore('category'), targetPolicy: 'requirePresent' },
    prompt: { committedStore: createStore('prompt'), targetPolicy: 'requirePresent' },
    note: { committedStore: createStore('note'), targetPolicy: 'requirePresent' },
    promptTemplate: { committedStore: createStore('promptTemplate'), targetPolicy: 'requirePresent' },
    workspacePromptCollectionUiState: {
      committedStore: createStore('workspacePromptCollectionUiState'),
      targetPolicy: 'deleteIfPresent'
    }
  }
  /** Clears all committed entries between handler tests. */
  const reset = (): void => {
    for (const store of Object.values(entries)) store.clear()
  }
  return { data, entries, reset }
})

vi.mock('../../src/main/Data/Data', () => ({ data: mockMainData.data }))

/** Stable projection returned after main recipes are applied once. */
const projectedDomainMutation = vi.hoisted(() => ({
  beforeGraph: {},
  afterGraph: {},
  transitions: []
}))

/** Projection spy used to inspect plans and expected revisions. */
const projectDomainTransitions = vi.hoisted(() => vi.fn(() => projectedDomainMutation))

/** Transition-native atomic execution spy. */
const runAtomicDomainTransitionTransaction = vi.hoisted(() =>
  vi.fn(async () => ({ status: 'success' }))
)

vi.mock('../../src/main/Data/AtomicDataTransaction', () => ({
  runAtomicDomainTransitionTransaction
}))
vi.mock('../../src/main/Data/DomainTransitions', () => ({ projectDomainTransitions }))
vi.mock('../../src/main/Data/GlobalMutationQueue', () => ({
  enqueueGlobalMutation: async <TResult>(mutation: () => Promise<TResult>) => await mutation()
}))

vi.mock('../../src/main/Data/DataSnapshotHelpers', () => ({
  buildWorkspaceSnapshot: (entry: MockSnapshotEntry) => ({
    id: entry.committed.id,
    revision: entry.revision,
    data: entry.committed
  }),
  buildPromptCollectionSnapshot: (entry: MockSnapshotEntry) => ({
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
type TestCommand = { collectionId: string }

/** Response subset inspected by generic handler tests. */
type TestHandlerResponse = {
  success: boolean
  conflict?: boolean
  error?: string
  payload: { snapshots: Array<Record<string, unknown>> }
}

/** prompt-collection record used by handler snapshots. */
const promptCollection = {
  id: 'root',
  kind: 'prompt' as const,
  folderName: 'Root',
  displayName: 'Root',
  statusFolders: createPromptStatusFolderLayouts({
    categoryOrders: {
      [PromptStatusFolderId.Active]: { categories: [{ categoryId: null, entries: [] }] }
    }
  }),
  settings: { collectionDescription: null }
}

/** Strict runtime parser supplied by the test mutation definition. */
const parseTestCommand: DomainCommandParser<TestCommand> = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw test command fields validated as an exact object. */
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 1 && typeof record.collectionId === 'string'
    ? { collectionId: record.collectionId }
    : null
}

/** Registers a handler and returns the Electron callback captured by the spy. */
const registerHandler = (planner: DomainPlanner<TestCommand>) => {
  handleMainDomainMutation({
    ipc: { channel: 'test-domain-mutation' },
    mutation: {
      parseCommand: parseTestCommand,
      plan: planner
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
    mockMainData.entries.promptCollection.set('root', {
      revision: 4,
      committed: promptCollection,
      persistenceFields: {}
    })
  })

  it('returns the main-computed target set when renderer targets differ', async () => {
    /** Planner whose correct target set contains the collection. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptCollection',
        id: command.collectionId,
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
      payload: { command: { collectionId: 'root' }, expectations: [] }
    })
    expect(result).toMatchObject({
      success: false,
      conflict: true,
      payload: {
        snapshots: [
          { entityType: 'promptCollection', id: 'root', revision: 4, data: promptCollection }
        ]
      }
    })
    expect(runAtomicDomainTransitionTransaction).not.toHaveBeenCalled()
  })

  it('rejects malformed commands through the mutation-specific parser', async () => {
    /** Planner spy that must not receive an invalid command. */
    const planner = vi.fn<DomainPlanner<TestCommand>>(() => [])
    /** Invalid request carrying an extra command property. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: {
        command: { collectionId: 'root', extra: true },
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
        command: { collectionId: 'root' },
        expectations: [
          { entityType: 'promptCollection', id: 'root', expected: 'revision' }
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
        command: { collectionId: 'root' },
        expectations: [
          {
            entityType: 'promptCollection',
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
        command: { collectionId: 'root' },
        expectations: [
          {
            entityType: 'promptCollection',
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
      payload: { command: { collectionId: 'root' }, expectations: [] }
    })
    expect(result.payload.snapshots).toEqual([
      { entityType: 'category', id: 'missing', deleted: true }
    ])
    expect(runAtomicDomainTransitionTransaction).not.toHaveBeenCalled()
  })

  it('returns authoritative snapshots without committing for a stale revision', async () => {
    /** Valid collection planner whose renderer revision is stale. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptCollection',
        id: command.collectionId,
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
        command: { collectionId: 'root' },
        expectations: [
          {
            entityType: 'promptCollection',
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
      payload: { snapshots: [{ entityType: 'promptCollection', id: 'root', revision: 4 }] }
    })
    expect(projectDomainTransitions).not.toHaveBeenCalled()
    expect(runAtomicDomainTransitionTransaction).not.toHaveBeenCalled()
  })

  it('returns authoritative snapshots when a renderer expects a present target to be absent', async () => {
    /** Valid collection planner whose renderer incorrectly expects insertion. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptCollection',
        id: command.collectionId,
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
        command: { collectionId: 'root' },
        expectations: [
          {
            entityType: 'promptCollection',
            id: 'root',
            expected: 'absent'
          }
        ]
      }
    })
    expect(result.payload.snapshots).toEqual([
      { entityType: 'promptCollection', id: 'root', revision: 4, data: promptCollection }
    ])
    expect(runAtomicDomainTransitionTransaction).not.toHaveBeenCalled()
  })

  it('projects transitions once and uses immediate atomic mode after revision validation', async () => {
    /** Valid collection update planner. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptCollection',
        id: command.collectionId,
        recipe: (draft) => {
          draft.displayName = 'Changed'
        }
      }
    ]
    /** Successful handler response after matching target and revision validation. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: {
        command: { collectionId: 'root' },
        expectations: [
          {
            entityType: 'promptCollection',
            id: 'root',
            expected: 'revision',
            revision: 4
          }
        ]
      }
    })
    expect(result.success).toBe(true)
    expect(projectDomainTransitions).toHaveBeenCalledWith(
      expect.any(Array),
      [{ entityType: 'promptCollection', id: 'root', expected: 'revision', revision: 4 }]
    )
    expect(runAtomicDomainTransitionTransaction).toHaveBeenCalledWith(
      projectedDomainMutation,
      {
        mode: 'immediate'
      }
    )
    expect(result.payload.snapshots).toEqual([
      { entityType: 'promptCollection', id: 'root', revision: 4, data: promptCollection }
    ])
  })

  it('uses collection delete policy for the required expectation target set', async () => {
    const optionalUiStateId = 'workspace:category'
    mockMainData.entries.workspacePromptCollectionUiState.set(optionalUiStateId, {
      revision: 7,
      committed: {
        workspaceId: 'workspace',
        contentOwnerId: 'category',
        selectedEntryId: 'category-details',
        treeIsExpanded: true,
        contentSectionIsExpanded: true,
        scrollTopByMode: {},
        selectedMode: PromptStatusFolderId.Active,
        shownFinalStatusGroups: {}
      },
      persistenceFields: {}
    })
    /** Planner containing one revision-checked update and one idempotent collection deletion. */
    const planner: DomainPlanner<TestCommand> = (_state, command) => [
      {
        type: 'update',
        entityType: 'promptCollection',
        id: command.collectionId,
        recipe: (draft) => {
          draft.displayName = 'Changed'
        }
      },
      {
        type: 'delete',
        entityType: 'workspacePromptCollectionUiState',
        id: optionalUiStateId
      }
    ]
    /** Successful request omitting the idempotently deleted UI-state revision. */
    const result = await registerHandler(planner)(null, {
      requestId: 'request',
      clientId: 'client',
      payload: {
        command: { collectionId: 'root' },
        expectations: [
          {
            entityType: 'promptCollection',
            id: 'root',
            expected: 'revision',
            revision: 4
          }
        ]
      }
    })

    expect(result.success).toBe(true)
    expect(projectDomainTransitions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'promptCollection', id: 'root' }),
        expect.objectContaining({
          entityType: 'workspacePromptCollectionUiState',
          id: optionalUiStateId
        })
      ]),
      [{ entityType: 'promptCollection', id: 'root', expected: 'revision', revision: 4 }]
    )
    expect(
      result.payload.snapshots.map((snapshot) => `${snapshot.entityType}:${snapshot.id}`)
    ).toEqual([
      'promptCollection:root',
      `workspacePromptCollectionUiState:${optionalUiStateId}`
    ])
  })
})
