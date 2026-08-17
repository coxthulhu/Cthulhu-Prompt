import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DROPPABLE_SNAP_DIMENSIONS,
  isPointInDroppableSnapZone,
  selectNearestDroppableCandidate
} from '@renderer/features/drag-drop/dragDrop.svelte.ts'

describe('drag-drop defaults', () => {
  it('expands targets by 100px vertically and 0px horizontally', () => {
    expect(DEFAULT_DROPPABLE_SNAP_DIMENSIONS).toEqual({ x: 0, y: 100 })

    /** Minimal target rectangle used to verify exact expansion boundaries. */
    const targetRect = { left: 10, right: 30, top: 20, bottom: 40 }
    expect(isPointInDroppableSnapZone(20, -79, targetRect, DEFAULT_DROPPABLE_SNAP_DIMENSIONS)).toBe(
      true
    )
    expect(isPointInDroppableSnapZone(20, -81, targetRect, DEFAULT_DROPPABLE_SNAP_DIMENSIONS)).toBe(
      false
    )
    expect(isPointInDroppableSnapZone(9, 20, targetRect, DEFAULT_DROPPABLE_SNAP_DIMENSIONS)).toBe(
      false
    )
  })

  it('keeps a blocked first candidate when an allowed candidate ties it', () => {
    /** First tied candidate models the earlier blocked registration. */
    const blockedCandidate = { distance: 12, isBlocked: true }
    /** Second tied candidate proves allowed state does not affect nearest selection. */
    const allowedCandidate = { distance: 12, isBlocked: false }

    expect(selectNearestDroppableCandidate([blockedCandidate, allowedCandidate])).toBe(
      blockedCandidate
    )
  })
})
