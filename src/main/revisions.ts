type RevisionStore = {
  get: (id: string) => number
  getClientTempId: (id: string) => string | undefined
  bump: (id: string) => number
  setClientTempId: (id: string, clientTempId: string) => void
  delete: (id: string) => void
}

type RevisionEntry = {
  revision: number
  clientTempId?: string
}

const createRevisionStore = (): RevisionStore => {
  const revisions = new Map<string, RevisionEntry>()

  return {
    get: (id) => revisions.get(id)?.revision ?? 0,
    getClientTempId: (id) => revisions.get(id)?.clientTempId,
    bump: (id) => {
      const entry = revisions.get(id)
      const nextRevision = (entry?.revision ?? 0) + 1
      revisions.set(id, { revision: nextRevision, clientTempId: entry?.clientTempId })
      return nextRevision
    },
    setClientTempId: (id, clientTempId) => {
      const entry = revisions.get(id)
      revisions.set(id, { revision: entry?.revision ?? 0, clientTempId })
    },
    delete: (id) => {
      revisions.delete(id)
    }
  }
}

// Unified in-memory revisions keyed by GUID.
export const revisions = {
  workspace: createRevisionStore(),
  promptFolder: createRevisionStore(),
  prompt: createRevisionStore()
}
