export class TanstackAuthoritativeRevisionTracker<TKey extends string | number> {
  private readonly revisions = new Map<TKey, number>()

  getRevision(key: TKey): number {
    return this.revisions.get(key) ?? 0
  }

  setRevision(key: TKey, revision: number): void {
    this.revisions.set(key, revision)
  }
}
