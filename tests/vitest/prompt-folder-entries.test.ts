import { isPromptFolderEmpty } from '@renderer/data/Collections/PromptFolderEntries'
import type { PromptFolder } from '@shared/PromptFolder'
import { describe, expect, it } from 'vitest'

const createFolder = (overrides: Partial<PromptFolder> = {}): PromptFolder => ({
  id: 'folder',
  kind: 'prompt',
  folderName: 'Folder',
  displayName: 'Folder',
  completedPromptIds: [],
  categoryOrder: { categories: [{ categoryId: null, entries: [] }] },
  settings: {
    folderDescription: ''
  },
  ...overrides
})

describe('isPromptFolderEmpty', () => {
  it('requires category-order entries, completed prompts, and settings to all be empty', () => {
    expect(isPromptFolderEmpty(createFolder())).toBe(true)
    expect(
      isPromptFolderEmpty(
        createFolder({
          categoryOrder: {
            categories: [
              { categoryId: null, entries: [{ kind: 'prompt', id: 'prompt' }] }
            ]
          }
        })
      )
    ).toBe(false)
    expect(isPromptFolderEmpty(createFolder({ completedPromptIds: ['completed'] }))).toBe(false)
    expect(
      isPromptFolderEmpty(
        createFolder({
          settings: {
            folderDescription: 'Description'
          }
        })
      )
    ).toBe(false)
  })
})
