/** Derives stable workspace, folder, and category identities from fixture seeds. */
export const createDeterministicId = (seed: string): string => {
  /** Unsigned rolling hash of the fixture seed. */
  let hash = 0
  // Character position retains the original deterministic hash order.
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  /** Padded suffix used by existing workspace and entity IDs. */
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}
