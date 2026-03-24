const WHOLE_SECOND_MS = 1000

export const getCurrentIsoSecondTimestamp = (): string => {
  const nowMs = Date.now()
  const wholeSecondMs = Math.trunc(nowMs / WHOLE_SECOND_MS) * WHOLE_SECOND_MS
  // Keep UTC ISO format while dropping millisecond precision (e.g., 2026-03-24T12:34:56Z).
  return new Date(wholeSecondMs).toISOString().replace('.000Z', 'Z')
}
