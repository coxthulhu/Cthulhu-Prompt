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
})
