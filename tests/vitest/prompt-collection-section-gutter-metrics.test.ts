import { describe, expect, test } from 'vitest'
import {
  PROMPT_COLLECTION_SECTION_INSET_PX,
  getPromptCollectionSectionContentOffsetPx,
  getPromptCollectionSectionContentWidthPx
} from '@renderer/features/prompt-collections/promptCollectionSectionGutterMetrics'

describe('prompt collection section nesting metrics', () => {
  test.each([
    { indentLevel: 0, contentOffsetPx: 0 },
    { indentLevel: 1, contentOffsetPx: 12 },
    { indentLevel: 2, contentOffsetPx: 24 },
    { indentLevel: 3, contentOffsetPx: 36 }
  ])(
    'insets level $indentLevel content on both sides',
    ({ indentLevel, contentOffsetPx }) => {
      expect(getPromptCollectionSectionContentOffsetPx(indentLevel)).toBe(contentOffsetPx)
      expect(PROMPT_COLLECTION_SECTION_INSET_PX * indentLevel).toBe(contentOffsetPx)
    }
  )

  test('subtracts both nesting insets from the available content width', () => {
    expect(getPromptCollectionSectionContentWidthPx(500, 1)).toBe(476)
    expect(getPromptCollectionSectionContentWidthPx(500, 2)).toBe(452)
    expect(getPromptCollectionSectionContentWidthPx(500, 3)).toBe(428)
  })

  test('clamps the available content width at zero', () => {
    expect(getPromptCollectionSectionContentWidthPx(40, 2)).toBe(0)
  })
})
