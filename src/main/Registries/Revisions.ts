type RevisionStore = {
  get: (id: string) => number
  bump: (id: string) => number
}

const createRevisionStore = (): RevisionStore => {
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

export const revisions = {
  userPersistence: createRevisionStore(),
  systemSettings: createRevisionStore(),
  workspace: createRevisionStore(),
  promptFolder: createRevisionStore(),
  prompt: createRevisionStore()
}
