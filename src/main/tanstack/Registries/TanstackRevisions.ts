type TanstackRevisionStore = {
  get: (id: string) => number
  bump: (id: string) => number
}

const createTanstackRevisionStore = (): TanstackRevisionStore => {
  // In-memory revision counters reset on every app startup.
  const revisions = new Map<string, number>()

  return {
    get: (id) => revisions.get(id) ?? 0,
    bump: (id) => {
      const nextRevision = (revisions.get(id) ?? 0) + 1
      revisions.set(id, nextRevision)
      return nextRevision
    }
  }
}

export const tanstackRevisions = {
  systemSettings: createTanstackRevisionStore(),
  workspace: createTanstackRevisionStore(),
  promptFolder: createTanstackRevisionStore(),
  prompt: createTanstackRevisionStore()
}
