type RevisionStore = {
  get: (id: string) => number
  bump: (id: string) => number
  delete: (id: string) => void
}

type SingletonRevisionStore = {
  get: () => number
  bump: () => number
}

const createRevisionStore = (): RevisionStore => {
  const revisions = new Map<string, number>()

  return {
    get: (id) => revisions.get(id) ?? 0,
    bump: (id) => {
      const nextRevision = (revisions.get(id) ?? 0) + 1
      revisions.set(id, nextRevision)
      return nextRevision
    },
    delete: (id) => {
      revisions.delete(id)
    }
  }
}

const createSingletonRevisionStore = (): SingletonRevisionStore => {
  let revision = 0

  return {
    get: () => revision,
    bump: () => {
      revision += 1
      return revision
    }
  }
}

// Unified in-memory revisions keyed by GUID (system settings is a singleton).
export const revisions = {
  workspace: createRevisionStore(),
  promptFolder: createRevisionStore(),
  prompt: createRevisionStore(),
  systemSettings: createSingletonRevisionStore()
}
