import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTransactionState = vi.hoisted(() => {
  const storeNames = ['systemSettings', 'workspace', 'promptFolder', 'prompt'] as const
  type StoreName = (typeof storeNames)[number]
  type Entry = {
    revision: number
    committed: unknown
    persistenceFields: unknown
  }

  const entriesByStore: Record<StoreName, Map<string, Entry>> = {
    systemSettings: new Map(),
    workspace: new Map(),
    promptFolder: new Map(),
    prompt: new Map()
  }

  const reset = (): void => {
    for (const storeName of storeNames) {
      entriesByStore[storeName].clear()
    }
  }

  const seedEntry = (store: StoreName, id: string, entry: Entry): void => {
    entriesByStore[store].set(id, entry)
  }

  const readEntry = (store: StoreName, id: string): Entry | null => {
    return entriesByStore[store].get(id) ?? null
  }

  const createCommittedStore = (store: StoreName) => {
    return {
      getRevision: (id: string) => entriesByStore[store].get(id)?.revision ?? 0,
      getEntry: (id: string) => entriesByStore[store].get(id) ?? null,
      setFromDisk: (id: string, data: unknown, persistenceFields: unknown) => {
        entriesByStore[store].set(id, {
          revision: 0,
          committed: data,
          persistenceFields
        })
      },
      commitAfterWrite: (id: string, data: unknown) => {
        const entry = entriesByStore[store].get(id)
        if (!entry) {
          throw new Error(`Missing entry ${store}:${id}`)
        }

        const nextRevision = entry.revision + 1
        entriesByStore[store].set(id, {
          revision: nextRevision,
          committed: data,
          persistenceFields: entry.persistenceFields
        })

        return nextRevision
      },
      remove: (id: string) => {
        entriesByStore[store].delete(id)
      }
    }
  }

  const createRevisionData = (store: StoreName) => {
    return {
      committedStore: createCommittedStore(store),
      persistence: {
        stageChanges: async (change: unknown) => change,
        commitChanges: async (_stagedChange: unknown) => undefined,
        revertChanges: async (_stagedChange: unknown) => undefined,
        loadData: async (_persistenceFields: unknown) => null
      },
      loadDataFromPersistence: async (_id: string, _persistenceFields: unknown) => undefined,
      emitCommittedRevisionChanged: (_id: string) => undefined
    }
  }

  return {
    data: {
      systemSettings: createRevisionData('systemSettings'),
      workspace: createRevisionData('workspace'),
      promptFolder: createRevisionData('promptFolder'),
      prompt: createRevisionData('prompt')
    },
    reset,
    seedEntry,
    readEntry
  }
})

vi.mock('../../src/main/Data/Data', () => {
  return {
    data: mockTransactionState.data
  }
})

vi.mock('../../src/main/Data/GlobalMutationQueue', () => {
  return {
    enqueueGlobalMutation: async <TResult>(mutation: () => Promise<TResult>): Promise<TResult> => {
      return await mutation()
    }
  }
})

import { runAtomicDataTransaction } from '../../src/main/Data/AtomicDataTransaction'

const SYSTEM_SETTINGS_ID = 'system-settings'
const PROMPT_ID = 'prompt-1'

describe('atomic data transaction', () => {
  beforeEach(() => {
    mockTransactionState.reset()
  })

  it('returns labeled committed results with data for updates and deletes', async () => {
    mockTransactionState.seedEntry('systemSettings', SYSTEM_SETTINGS_ID, {
      revision: 1,
      committed: {
        promptFontSize: 16,
        promptEditorMinLines: 3
      },
      persistenceFields: {}
    })
    mockTransactionState.seedEntry('prompt', PROMPT_ID, {
      revision: 4,
      committed: { id: PROMPT_ID },
      persistenceFields: { folderName: 'Folder', workspacePath: 'C:\\Workspace' }
    })

    const outcome = await runAtomicDataTransaction((tx) => {
      return {
        systemSettings: tx.systemSettings.update({
          id: SYSTEM_SETTINGS_ID,
          expectedRevision: 1,
          recipe: (draft) => {
            draft.promptFontSize = 22
          }
        }),
        prompt: tx.prompt.delete({
          id: PROMPT_ID,
          expectedRevision: 4
        })
      }
    })

    expect(outcome.status).toBe('success')
    if (outcome.status !== 'success') {
      return
    }

    expect(outcome.results.systemSettings.revision).toBe(2)
    expect(outcome.results.systemSettings.data).toEqual({
      promptFontSize: 22,
      promptEditorMinLines: 3
    })
    expect(outcome.results.prompt.revision).toBeNull()
    expect(outcome.results.prompt.data).toBeNull()
    expect(mockTransactionState.readEntry('prompt', PROMPT_ID)).toBeNull()
  })

  it('returns a CAS conflict result when expected revision does not match', async () => {
    mockTransactionState.seedEntry('systemSettings', SYSTEM_SETTINGS_ID, {
      revision: 7,
      committed: {
        promptFontSize: 18,
        promptEditorMinLines: 4
      },
      persistenceFields: {}
    })

    const outcome = await runAtomicDataTransaction((tx) => {
      return {
        systemSettings: tx.systemSettings.update({
          id: SYSTEM_SETTINGS_ID,
          expectedRevision: 6,
          recipe: (draft) => {
            draft.promptEditorMinLines = 8
          }
        })
      }
    })

    expect(outcome.status).toBe('conflict')
    if (outcome.status !== 'conflict') {
      return
    }

    expect(outcome.conflictLabel).toBe('systemSettings')
    expect(outcome.conflicts).toEqual({
      systemSettings: {
        store: 'systemSettings',
        id: SYSTEM_SETTINGS_ID,
        expectedRevision: 6,
        actualRevision: 7,
        data: {
          promptFontSize: 18,
          promptEditorMinLines: 4
        }
      }
    })
  })
})
