import { describe, expect, it } from 'vitest'
import {
  hasCategoryDisplayNameConflict,
  normalizeCategoryDisplayName,
  type Category
} from '@shared/Category'
import { parseCategoryJson } from '../../src/main/Persistence/CategoryPersistence'

/** Stable category fixtures used by category validation tests. */
const categories: Category[] = [
  { id: 'category-1', displayName: 'Code Review', description: null },
  { id: 'category-2', displayName: 'Testing', description: '' }
]

describe('categories', () => {
  it('trims names and detects case-insensitive conflicts within one root', () => {
    expect(normalizeCategoryDisplayName('  Code Review  ')).toBe('Code Review')
    expect(hasCategoryDisplayNameConflict(categories, ' code review ')).toBe(true)
    expect(hasCategoryDisplayNameConflict(categories, 'CODE REVIEW', 'category-1')).toBe(false)
    expect(hasCategoryDisplayNameConflict(categories, 'Documentation')).toBe(false)
  })

  it('parses the exact persisted category shape and preserves description values', () => {
    expect(
      parseCategoryJson(
        JSON.stringify({ id: 'category-1', displayName: 'Code Review', description: null })
      )
    ).toEqual(categories[0])
    expect(
      parseCategoryJson(
        JSON.stringify({ id: 'category-2', displayName: 'Testing', description: '' })
      )
    ).toEqual(categories[1])
    expect(
      parseCategoryJson(
        JSON.stringify({ id: 'category-3', displayName: 'Extra', description: null, extra: true })
      )
    ).toBeNull()
  })
})
