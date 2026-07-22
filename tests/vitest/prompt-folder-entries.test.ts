import { isPromptFolderEmpty } from '@renderer/data/Collections/PromptFolderEntries'
import type { PromptFolder } from '@shared/PromptFolder'
import { describe, expect, it } from 'vitest'

const createFolder = (overrides: Partial<PromptFolder> = {}): PromptFolder => ({
  id: 'folder',
  kind: 'prompt',
  folderName: 'Folder',
  displayName: 'Folder',
  entries: [],
  completedPromptIds: [],
  settings: {
    folderDescription: '',
    folderPrefix: '',
    folderSuffix: ''
  },
  ...overrides
})

describe('isPromptFolderEmpty', () => {
  it('requires entries, completed prompts, and settings to all be empty', () => {
    expect(isPromptFolderEmpty(createFolder())).toBe(true)
    expect(isPromptFolderEmpty(createFolder({ entries: [{ kind: 'prompt', id: 'prompt' }] }))).toBe(
      false
    )
    expect(
      isPromptFolderEmpty(createFolder({ entries: [{ kind: 'folder', id: 'subfolder' }] }))
    ).toBe(false)
    expect(isPromptFolderEmpty(createFolder({ completedPromptIds: ['completed'] }))).toBe(false)
    expect(
      isPromptFolderEmpty(
        createFolder({
          settings: {
            folderDescription: 'Description',
            folderPrefix: '',
            folderSuffix: ''
          }
        })
      )
    ).toBe(false)
  })
})
