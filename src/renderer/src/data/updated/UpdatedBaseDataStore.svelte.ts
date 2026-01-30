import { SvelteMap } from 'svelte/reactivity'

export type Snapshot<T> = {
  data: T
  revision: number
}

export type Entry<T> = {
  baseSnapshot: Snapshot<T> | null
  draftSnapshot: T | null
}

export type BaseDataStore<T> = {
  entries: SvelteMap<string, Entry<T>>
  getEntry: (id: string) => Entry<T> | null
  optimisticInsert: (draft: T, idOverride?: string) => string
  commitDraftInsert: (draftId: string, nextId: string, base: Snapshot<T>) => void
  optimisticDelete: (id: string) => void
  revertDraftFromBase: (id: string) => void
  commitDeletion: (id: string) => void
  applyFetch: (id: string, base: Snapshot<T>) => void
  applyOptimisticChanges: (id: string, base: Snapshot<T>) => void
}

const cloneData = <T>(data: T): T => structuredClone(data)

const createEntry = <T>(
  baseSnapshot: Snapshot<T> | null,
  draftSnapshot: T | null
): Entry<T> =>
  // Use $state so nested snapshot updates propagate to reactive consumers.
  $state<Entry<T>>({ baseSnapshot, draftSnapshot })

export const createBaseDataStore = <T>(): BaseDataStore<T> => {
  const entries = new SvelteMap<string, Entry<T>>()

  const getEntry = (id: string): Entry<T> | null => entries.get(id) ?? null

  const optimisticInsert = (draft: T, idOverride?: string): string => {
    const id = idOverride ?? crypto.randomUUID()
    entries.set(id, createEntry(null, draft))
    return id
  }

  const commitDraftInsert = (
    draftId: string,
    nextId: string,
    base: Snapshot<T>
  ): void => {
    const entry = entries.get(draftId)!
    entry.baseSnapshot = base

    if (draftId !== nextId) {
      entries.delete(draftId)
      entries.set(nextId, entry)
    }
  }

  const optimisticDelete = (id: string): void => {
    const entry = entries.get(id)!
    entry.draftSnapshot = null

    if (!entry.baseSnapshot) {
      entries.delete(id)
    }
  }

  const revertDraftFromBase = (id: string): void => {
    const entry = entries.get(id)!
    if (!entry.baseSnapshot) {
      entries.delete(id)
      return
    }

    entry.draftSnapshot = cloneData(entry.baseSnapshot.data)
  }

  const commitDeletion = (id: string): void => {
    entries.delete(id)
  }

  const applyFetch = (id: string, base: Snapshot<T>): void => {
    const entry = entries.get(id) ?? createEntry<T>(null, null)
    const previousRevision = entry.baseSnapshot?.revision ?? null

    entry.baseSnapshot = base

    if (previousRevision !== base.revision) {
      entry.draftSnapshot = cloneData(base.data)
    }

    entries.set(id, entry)
  }

  const applyOptimisticChanges = (id: string, base: Snapshot<T>): void => {
    const entry = entries.get(id) ?? createEntry<T>(null, null)
    entry.baseSnapshot = base
    entries.set(id, entry)
  }

  return {
    entries,
    getEntry,
    optimisticInsert,
    commitDraftInsert,
    optimisticDelete,
    revertDraftFromBase,
    commitDeletion,
    applyFetch,
    applyOptimisticChanges
  }
}
