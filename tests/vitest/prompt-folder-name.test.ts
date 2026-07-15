import { describe, it, expect } from 'vitest'
import {
  hasPromptFolderNameConflict,
  sanitizePromptFolderName,
  validatePromptFolderName
} from '@shared/promptFolderName'

describe('prompt folder name helpers', () => {
  describe('validatePromptFolderName', () => {
    it('accepts valid folder names', () => {
      expect(validatePromptFolderName('Valid Folder').isValid).toBe(true)
      expect(validatePromptFolderName('Folder123').isValid).toBe(true)
      expect(validatePromptFolderName('My-Folder_Name').isValid).toBe(true)
    })

    it('rejects invalid folder names', () => {
      expect(validatePromptFolderName('').isValid).toBe(false)
      expect(validatePromptFolderName('   ').isValid).toBe(false)
      expect(validatePromptFolderName('Folder<Name').isValid).toBe(false)
      expect(validatePromptFolderName('Folder>Name').isValid).toBe(false)
      expect(validatePromptFolderName('Folder:Name').isValid).toBe(false)
      expect(validatePromptFolderName('Folder"Name').isValid).toBe(false)
      expect(validatePromptFolderName('Folder/Name').isValid).toBe(false)
      expect(validatePromptFolderName('Folder\\Name').isValid).toBe(false)
      expect(validatePromptFolderName('Folder|Name').isValid).toBe(false)
      expect(validatePromptFolderName('Folder?Name').isValid).toBe(false)
      expect(validatePromptFolderName('Folder*Name').isValid).toBe(false)
    })

    it('rejects folder names that are too long', () => {
      expect(validatePromptFolderName('a'.repeat(101)).isValid).toBe(false)
    })
  })

  describe('sanitizePromptFolderName', () => {
    it('removes spaces from folder names', () => {
      expect(sanitizePromptFolderName('Test Folder')).toBe('TestFolder')
      expect(sanitizePromptFolderName('My   Multiple   Spaces')).toBe('MyMultipleSpaces')
      expect(sanitizePromptFolderName('  Leading And Trailing  ')).toBe('LeadingAndTrailing')
    })

    it('handles various whitespace characters', () => {
      expect(sanitizePromptFolderName('Tab\tSeparated')).toBe('TabSeparated')
      expect(sanitizePromptFolderName('Line\nBreak')).toBe('LineBreak')
      expect(sanitizePromptFolderName('Mixed \t\n Whitespace')).toBe('MixedWhitespace')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(sanitizePromptFolderName('   ')).toBe('')
      expect(sanitizePromptFolderName('\t\n ')).toBe('')
    })
  })

  describe('hasPromptFolderNameConflict', () => {
    const promptFolders = [
      { id: 'first', folderName: 'FirstFolder' },
      { id: 'second', folderName: 'SecondFolder' }
    ]

    it('matches folder names case-insensitively', () => {
      expect(hasPromptFolderNameConflict(promptFolders, 'firstfolder')).toBe(true)
      expect(hasPromptFolderNameConflict(promptFolders, 'AvailableFolder')).toBe(false)
    })

    it('excludes the folder being renamed', () => {
      expect(hasPromptFolderNameConflict(promptFolders, 'FirstFolder', 'first')).toBe(false)
      expect(
        hasPromptFolderNameConflict(
          [...promptFolders, { id: 'third', folderName: 'FIRSTFOLDER' }],
          'FirstFolder',
          'first'
        )
      ).toBe(true)
    })
  })
})
