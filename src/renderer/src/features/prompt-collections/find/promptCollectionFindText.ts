/** Original-text offsets returned by Monaco's search model. */
export type FindMatchRange = {
  startOffset: number
  endOffset: number
}

/** Finds the first Monaco match beginning at or after the search anchor. */
export const findMatchIndexAtOrAfter = (
  ranges: FindMatchRange[],
  offset: number
): number | null => {
  /** Section-local result index, preserving Monaco's match ordering. */
  const index = ranges.findIndex((range) => range.startOffset >= offset)
  return index < 0 ? null : index
}

/** Finds the last complete Monaco match before the cursor, including one ending exactly at it. */
export const findMatchIndexEndingAtOrBefore = (
  ranges: FindMatchRange[],
  offset: number
): number | null => {
  // Walk backward to find the nearest eligible result without copying the ranges.
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    if (ranges[index].endOffset <= offset) return index
  }
  return null
}
