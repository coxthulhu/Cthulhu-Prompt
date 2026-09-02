import { isPromptFolderEmpty } from '@renderer/data/Collections/PromptFolderEntries'
import {
  createPromptStatusFolderLayouts,
  type PromptFolder
} from '@shared/PromptFolder'
import { PROMPT_STATUS_FOLDERS, PromptStatusFolderId } from '@shared/Prompt'
import { describe, expect, it } from 'vitest'

const createFolder = (overrides: Partial<PromptFolder> = {}): PromptFolder => ({
  id: 'folder',
  kind: 'prompt',
  folderName: 'Folder',
  displayName: 'Folder',
  statusFolders: createPromptStatusFolderLayouts(),
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
          statusFolders: createPromptStatusFolderLayouts({
            categoryOrders: {
              [PromptStatusFolderId.Active]: {
                categories: [
                  { categoryId: null, entries: [{ kind: 'prompt', id: 'prompt' }] }
                ]
              }
            }
          })
        })
      )
    ).toBe(false)
    expect(
      isPromptFolderEmpty(
        createFolder({
          statusFolders: createPromptStatusFolderLayouts({
            promptIds: { [PromptStatusFolderId.Completed]: ['completed'] }
          })
        })
      )
    ).toBe(false)
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

describe('prompt status-folder layouts', () => {
  it('creates one correctly ordered layout for every registry entry', () => {
    /** Default layouts created solely from the code-defined status-folder registry. */
    const layouts = createPromptStatusFolderLayouts()

    expect(Object.keys(layouts)).toEqual(PROMPT_STATUS_FOLDERS.map(({ id }) => id))
    expect(
      PROMPT_STATUS_FOLDERS.map(({ id }) => [id, layouts[id].ordering])
    ).toEqual(PROMPT_STATUS_FOLDERS.map(({ id, ordering }) => [id, ordering]))
  })
})
