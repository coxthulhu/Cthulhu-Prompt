import { SvelteMap } from 'svelte/reactivity'

export type Snapshot<T> = {
  data: T
  revision: number
}

export type Entry<T> = {
  lastServerSnapshot: Snapshot<T> | null
  draftSnapshot: T | null
}

export type BaseDataStore<T> = {
  entries: SvelteMap<string, Entry<T>>
  getEntry: (id: string) => Entry<T> | null
  optimisticInsert: (draft: T, idOverride?: string) => string
  optimisticDelete: (id: string) => void
  applyFetch: (id: string, lastServerSnapshot: Snapshot<T>) => void
}

const cloneData = <T>(data: T): T => structuredClone(data)

const createEntry = <T>(
  lastServerSnapshot: Snapshot<T> | null,
  draftSnapshot: T | null
): Entry<T> =>
  // Use $state so nested snapshot updates propagate to reactive consumers.
  $state<Entry<T>>({ lastServerSnapshot, draftSnapshot })

export const createBaseDataStore = <T>(): BaseDataStore<T> => {
  const entries = new SvelteMap<string, Entry<T>>()

  const getEntry = (id: string): Entry<T> | null => entries.get(id) ?? null

  const optimisticInsert = (draft: T, idOverride?: string): string => {
    const id = idOverride ?? crypto.randomUUID()
    entries.set(id, createEntry(null, draft))
    return id
  }

  const optimisticDelete = (id: string): void => {
    const entry = entries.get(id)!
    entry.draftSnapshot = null

    if (!entry.lastServerSnapshot) {
      entries.delete(id)
    }
  }

  const applyFetch = (id: string, lastServerSnapshot: Snapshot<T>): void => {
    const entry = entries.get(id) ?? createEntry<T>(null, null)
    const previousRevision = entry.lastServerSnapshot?.revision ?? null

    entry.lastServerSnapshot = lastServerSnapshot

    if (previousRevision !== lastServerSnapshot.revision) {
      entry.draftSnapshot = cloneData(lastServerSnapshot.data)
    }

    entries.set(id, entry)
  }

  return {
    entries,
    getEntry,
    optimisticInsert,
    optimisticDelete,
    applyFetch
  }
}
