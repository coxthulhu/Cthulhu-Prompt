import { describe, expect, test } from 'vitest'
import {
  getPromptFolderSectionContentOffsetPx,
  getPromptFolderSectionContentWidthPx,
  getPromptFolderSectionGutterGapPx,
  getPromptFolderSectionGutterWidthPx
} from '@renderer/features/prompt-folders/promptFolderSectionGutterMetrics'

describe('prompt folder section gutter metrics', () => {
  test.each([
    { indentLevel: 0, gutterWidthPx: 0, gutterGapPx: 0, contentOffsetPx: 0 },
    { indentLevel: 1, gutterWidthPx: 12, gutterGapPx: 12, contentOffsetPx: 24 },
    { indentLevel: 2, gutterWidthPx: 36, gutterGapPx: 12, contentOffsetPx: 48 },
    { indentLevel: 3, gutterWidthPx: 60, gutterGapPx: 12, contentOffsetPx: 72 }
  ])(
    'calculates the level $indentLevel gutter and content offsets',
    ({ indentLevel, gutterWidthPx, gutterGapPx, contentOffsetPx }) => {
      expect(getPromptFolderSectionGutterWidthPx(indentLevel)).toBe(gutterWidthPx)
      expect(getPromptFolderSectionGutterGapPx(indentLevel)).toBe(gutterGapPx)
      expect(getPromptFolderSectionContentOffsetPx(indentLevel)).toBe(contentOffsetPx)
    }
  )

  test('subtracts the complete indent offset from the available content width', () => {
    expect(getPromptFolderSectionContentWidthPx(500, 1)).toBe(476)
    expect(getPromptFolderSectionContentWidthPx(500, 2)).toBe(452)
    expect(getPromptFolderSectionContentWidthPx(500, 3)).toBe(428)
  })

  test('clamps the available content width at zero', () => {
    expect(getPromptFolderSectionContentWidthPx(40, 2)).toBe(0)
  })
})
