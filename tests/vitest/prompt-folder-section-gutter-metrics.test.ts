import { describe, expect, test } from 'vitest'
import {
  PROMPT_FOLDER_SECTION_INSET_PX,
  getPromptFolderSectionContentOffsetPx,
  getPromptFolderSectionContentWidthPx
} from '@renderer/features/prompt-folders/promptFolderSectionGutterMetrics'

describe('prompt folder section nesting metrics', () => {
  test.each([
    { indentLevel: 0, contentOffsetPx: 0 },
    { indentLevel: 1, contentOffsetPx: 12 },
    { indentLevel: 2, contentOffsetPx: 24 },
    { indentLevel: 3, contentOffsetPx: 36 }
  ])(
    'insets level $indentLevel content on both sides',
    ({ indentLevel, contentOffsetPx }) => {
      expect(getPromptFolderSectionContentOffsetPx(indentLevel)).toBe(contentOffsetPx)
      expect(PROMPT_FOLDER_SECTION_INSET_PX * indentLevel).toBe(contentOffsetPx)
    }
  )

  test('subtracts both nesting insets from the available content width', () => {
    expect(getPromptFolderSectionContentWidthPx(500, 1)).toBe(476)
    expect(getPromptFolderSectionContentWidthPx(500, 2)).toBe(452)
    expect(getPromptFolderSectionContentWidthPx(500, 3)).toBe(428)
  })

  test('clamps the available content width at zero', () => {
    expect(getPromptFolderSectionContentWidthPx(40, 2)).toBe(0)
  })
})
