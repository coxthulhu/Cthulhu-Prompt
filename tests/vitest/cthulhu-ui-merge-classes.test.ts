import { describe, expect, it } from 'vitest'
import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

describe('cthulhu-ui mergeClasses', () => {
  it('keeps the last conflicting utility', () => {
    expect(mergeClasses('h-9 px-3', 'h-11 px-4')).toBe('h-11 px-4')
  })

  it('deduplicates repeated utilities', () => {
    expect(mergeClasses('rounded-2xl text-sm', 'rounded-2xl text-sm')).toBe('rounded-2xl text-sm')
  })

  it('ignores falsy inputs', () => {
    expect(mergeClasses('border-white/12', undefined, false, null, 'bg-white/[0.06]')).toBe(
      'border-white/12 bg-white/[0.06]'
    )
  })

  it('flattens array and object inputs before merging', () => {
    expect(
      mergeClasses(['h-9', { 'px-3': true, hidden: false }], ['h-11', ['px-4', null, false]])
    ).toBe('h-11 px-4')
  })
})
