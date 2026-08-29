import { describe, expect, it } from 'vitest'
import {
  getCurrentIsoSecondTimestamp,
  parseIsoSecondTimestamp
} from '@shared/isoTimestamp'

describe('ISO second timestamps', () => {
  it('accepts the exact UTC whole-second client format', () => {
    /** Valid client-generated timestamp accepted without normalization. */
    const timestamp = '2026-08-29T12:34:56Z'
    expect(parseIsoSecondTimestamp(timestamp)).toBe(timestamp)
  })

  it('accepts the timestamp produced by the client generator', () => {
    /** Current client-generated timestamp passed through the main-process parser. */
    const timestamp = getCurrentIsoSecondTimestamp()
    expect(parseIsoSecondTimestamp(timestamp)).toBe(timestamp)
  })

  it.each([
    '2026-08-29T12:34:56.000Z',
    '2026-08-29T12:34:56+00:00',
    '2026-02-30T12:34:56Z',
    'timestamp'
  ])('rejects a noncanonical or invalid timestamp: %s', (timestamp) => {
    expect(parseIsoSecondTimestamp(timestamp)).toBeNull()
  })
})
