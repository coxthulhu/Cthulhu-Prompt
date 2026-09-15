const WHOLE_SECOND_MS = 1000

/** Exact UTC whole-second ISO shape generated and accepted by domain mutations. */
const ISO_SECOND_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

export const getCurrentIsoSecondTimestamp = (): string => {
  const nowMs = Date.now()
  const wholeSecondMs = Math.trunc(nowMs / WHOLE_SECOND_MS) * WHOLE_SECOND_MS
  // Keep UTC ISO format while dropping millisecond precision (e.g., 2026-03-24T12:34:56Z).
  return new Date(wholeSecondMs).toISOString().replace('.000Z', 'Z')
}

/** Parses an exact, calendar-valid UTC whole-second ISO timestamp. */
export const parseIsoSecondTimestamp = (value: unknown): string | null => {
  if (typeof value !== 'string' || !ISO_SECOND_TIMESTAMP_PATTERN.test(value)) return null
  /** Milliseconds represented by the structurally valid timestamp candidate. */
  const timestampMs = Date.parse(value)
  if (!Number.isFinite(timestampMs)) return null
  /** Canonical whole-second form used to reject normalized invalid calendar values. */
  const canonicalTimestamp = new Date(timestampMs).toISOString().replace('.000Z', 'Z')
  return canonicalTimestamp === value ? value : null
}
