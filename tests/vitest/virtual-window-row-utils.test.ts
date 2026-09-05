import { describe, expect, test } from 'vitest'
import type { VirtualRowState } from '@renderer/features/virtualizer/virtualWindowRows'
import { computeAnchoredScrollTop } from '@renderer/features/virtualizer/virtualWindowRowUtils'

type TestRow = { kind: 'row' }

const buildRows = (ids: string[]): VirtualRowState<TestRow>[] =>
  ids.map(
    (id, index) =>
      ({
        id,
        index,
        offset: index * 32,
        height: 32,
        rowData: { kind: 'row' }
      }) as VirtualRowState<TestRow>
  )

describe('computeAnchoredScrollTop', () => {
  const previousRows = buildRows(['first', 'second', 'third'])
  const prependedRows = buildRows(['new', 'first', 'second', 'third'])

  test('keeps a top-anchored viewport pinned to the collection start', () => {
    expect(computeAnchoredScrollTop(previousRows, prependedRows, 0, 0)).toBe(0)
  })

  test('preserves the visible row after the viewport has scrolled down', () => {
    expect(computeAnchoredScrollTop(previousRows, prependedRows, 40, 0)).toBe(72)
  })

  test('preserves center anchoring even when the scroll position is zero', () => {
    expect(computeAnchoredScrollTop(previousRows, prependedRows, 0, 48)).toBe(32)
  })

  test('preserves the exact fractional scroll position when the anchor has not moved', () => {
    const rows = [
      { ...previousRows[0], offset: 0, height: 985.6 },
      { ...previousRows[1], offset: 985.6, height: 80 }
    ]
    expect(computeAnchoredScrollTop(rows, rows, 725.6, 300)).toBe(725.6)
  })

  test('adjusts a fractional scroll position only by the anchor row movement', () => {
    const rows = [
      { ...previousRows[0], offset: 0, height: 985.6 },
      { ...previousRows[1], offset: 985.6, height: 80 }
    ]
    const movedRows = rows.map((row) => ({ ...row, offset: row.offset + 40 }))
    const movedScrollTop = computeAnchoredScrollTop(rows, movedRows, 725.6, 300)
    expect(movedScrollTop).toBeCloseTo(765.6, 10)
    expect(computeAnchoredScrollTop(movedRows, movedRows, movedScrollTop, 300)).toBe(movedScrollTop)
  })

  test('keeps the scroll position when the anchor disappears or rows only reorder', () => {
    expect(computeAnchoredScrollTop(previousRows, [previousRows[0]], 40, 0)).toBe(40)
    expect(computeAnchoredScrollTop(previousRows, [...previousRows].reverse(), 40, 0)).toBe(40)
  })
})
