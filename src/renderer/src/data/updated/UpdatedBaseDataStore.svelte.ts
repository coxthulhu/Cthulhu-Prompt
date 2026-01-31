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
  mergeAuthoritativeSnapshot: (id: string, snapshot: Snapshot<T>, conflict?: boolean) => void
}

const cloneData = <T>(data: T): T => structuredClone(data)

const isDeepEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true
  }

  if (typeof left !== 'object' || typeof right !== 'object' || !left || !right) {
    return false
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false
    }

    if (left.length !== right.length) {
      return false
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!isDeepEqual(left[index], right[index])) {
        return false
      }
    }

    return true
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false
    }

    if (
      !isDeepEqual(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key]
      )
    ) {
      return false
    }
  }

  return true
}

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

  const mergeAuthoritativeSnapshot = (
    id: string,
    snapshot: Snapshot<T>,
    conflict = false
  ): void => {
    const entry = entries.get(id) ?? createEntry<T>(null, null)
    const previousSnapshot = entry.lastServerSnapshot

    if (!previousSnapshot) {
      console.error('Missing last server snapshot for merge.')
      entry.lastServerSnapshot = snapshot
      entries.set(id, entry)
      return
    }

    if (snapshot.revision <= previousSnapshot.revision) {
      return
    }

    if (!entry.draftSnapshot) {
      entry.lastServerSnapshot = snapshot
      entries.set(id, entry)
      return
    }

    const draft = entry.draftSnapshot as Record<string, unknown>
    const lastData = previousSnapshot.data as Record<string, unknown>
    const nextData = snapshot.data as Record<string, unknown>

    // Merge new server fields into the draft while preserving user edits.
    for (const key of Object.keys(nextData)) {
      if (conflict || isDeepEqual(draft[key], lastData[key])) {
        draft[key] = cloneData(nextData[key])
      }
    }

    entry.lastServerSnapshot = snapshot
    entries.set(id, entry)
  }

  return {
    entries,
    getEntry,
    optimisticInsert,
    optimisticDelete,
    applyFetch,
    mergeAuthoritativeSnapshot
  }
}
