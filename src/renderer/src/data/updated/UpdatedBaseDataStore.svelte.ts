import { SvelteMap } from 'svelte/reactivity'

export type UpdatedSnapshot<T> = {
  data: T
  revision: number
}

export type UpdatedEntry<T> = {
  baseSnapshot: UpdatedSnapshot<T> | null
  draftSnapshot: T | null
}

export type UpdatedBaseDataStore<T> = {
  entries: SvelteMap<string, UpdatedEntry<T>>
  getEntry: (id: string) => UpdatedEntry<T> | null
  insertDraft: (draft: T, idOverride?: string) => string
  commitDraftInsert: (draftId: string, nextId: string, base: UpdatedSnapshot<T>) => void
  deleteDraft: (id: string) => void
  revertDraftFromBase: (id: string) => void
  commitDeletion: (id: string) => void
  applyFetch: (id: string, base: UpdatedSnapshot<T>) => void
  applyOptimisticChanges: (id: string, base: UpdatedSnapshot<T>) => void
}

const cloneData = <T>(data: T): T => structuredClone(data)

const createEntry = <T>(
  baseSnapshot: UpdatedSnapshot<T> | null,
  draftSnapshot: T | null
): UpdatedEntry<T> =>
  // Use $state so nested snapshot updates propagate to reactive consumers.
  $state<UpdatedEntry<T>>({ baseSnapshot, draftSnapshot })

export const createUpdatedBaseDataStore = <T>(): UpdatedBaseDataStore<T> => {
  const entries = new SvelteMap<string, UpdatedEntry<T>>()

  const getEntry = (id: string): UpdatedEntry<T> | null => entries.get(id) ?? null

  const insertDraft = (draft: T, idOverride?: string): string => {
    const id = idOverride ?? crypto.randomUUID()
    entries.set(id, createEntry(null, draft))
    return id
  }

  const commitDraftInsert = (
    draftId: string,
    nextId: string,
    base: UpdatedSnapshot<T>
  ): void => {
    const entry = entries.get(draftId)!
    entry.baseSnapshot = base

    if (draftId !== nextId) {
      entries.delete(draftId)
      entries.set(nextId, entry)
    }
  }

  const deleteDraft = (id: string): void => {
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

  const applyFetch = (id: string, base: UpdatedSnapshot<T>): void => {
    const entry = entries.get(id) ?? createEntry<T>(null, null)
    const previousRevision = entry.baseSnapshot?.revision ?? null

    entry.baseSnapshot = base

    if (previousRevision !== base.revision) {
      entry.draftSnapshot = cloneData(base.data)
    }

    entries.set(id, entry)
  }

  const applyOptimisticChanges = (id: string, base: UpdatedSnapshot<T>): void => {
    const entry = entries.get(id) ?? createEntry<T>(null, null)
    entry.baseSnapshot = base
    entries.set(id, entry)
  }

  return {
    entries,
    getEntry,
    insertDraft,
    commitDraftInsert,
    deleteDraft,
    revertDraftFromBase,
    commitDeletion,
    applyFetch,
    applyOptimisticChanges
  }
}
