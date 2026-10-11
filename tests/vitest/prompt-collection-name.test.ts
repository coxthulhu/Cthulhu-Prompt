import { describe, it, expect } from 'vitest'
import {
  hasPromptCollectionNameConflict,
  sanitizePromptCollectionName,
  validatePromptCollectionName
} from '@shared/domain/prompt-collection/promptCollectionName'

describe('prompt collection name helpers', () => {
  describe('validatePromptCollectionName', () => {
    it('accepts valid collection names', () => {
      expect(validatePromptCollectionName('Valid Collection').isValid).toBe(true)
      expect(validatePromptCollectionName('Collection123').isValid).toBe(true)
      expect(validatePromptCollectionName('My-Collection_Name').isValid).toBe(true)
    })

    it('rejects invalid collection names', () => {
      expect(validatePromptCollectionName('').isValid).toBe(false)
      expect(validatePromptCollectionName('   ').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection<Name').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection>Name').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection:Name').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection"Name').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection/Name').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection\\Name').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection|Name').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection?Name').isValid).toBe(false)
      expect(validatePromptCollectionName('Collection*Name').isValid).toBe(false)
    })

    it('rejects collection names that are too long', () => {
      expect(validatePromptCollectionName('a'.repeat(101)).isValid).toBe(false)
    })
  })

  describe('sanitizePromptCollectionName', () => {
    it('removes spaces from collection names', () => {
      expect(sanitizePromptCollectionName('Test Collection')).toBe('TestCollection')
      expect(sanitizePromptCollectionName('My   Multiple   Spaces')).toBe('MyMultipleSpaces')
      expect(sanitizePromptCollectionName('  Leading And Trailing  ')).toBe('LeadingAndTrailing')
    })

    it('handles various whitespace characters', () => {
      expect(sanitizePromptCollectionName('Tab\tSeparated')).toBe('TabSeparated')
      expect(sanitizePromptCollectionName('Line\nBreak')).toBe('LineBreak')
      expect(sanitizePromptCollectionName('Mixed \t\n Whitespace')).toBe('MixedWhitespace')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(sanitizePromptCollectionName('   ')).toBe('')
      expect(sanitizePromptCollectionName('\t\n ')).toBe('')
    })
  })

  describe('hasPromptCollectionNameConflict', () => {
    const promptCollections = [
      { id: 'first', folderName: 'FirstCollection' },
      { id: 'second', folderName: 'SecondCollection' }
    ]

    it('matches collection names case-insensitively', () => {
      expect(hasPromptCollectionNameConflict(promptCollections, 'firstcollection')).toBe(true)
      expect(hasPromptCollectionNameConflict(promptCollections, 'AvailableCollection')).toBe(false)
    })

    it('excludes the collection being renamed', () => {
      expect(hasPromptCollectionNameConflict(promptCollections, 'FirstCollection', 'first')).toBe(false)
      expect(
        hasPromptCollectionNameConflict(
          [...promptCollections, { id: 'third', folderName: 'FIRSTCOLLECTION' }],
          'FirstCollection',
          'first'
        )
      ).toBe(true)
    })
  })
})
