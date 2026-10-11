import { isPromptCollectionEmpty } from '@renderer/data/Collections/PromptCollectionEntries'
import {
  createPromptStatusFolderLayouts,
  type PromptCollection
} from '@shared/domain/prompt-collection/PromptCollection'
import { PROMPT_STATUS_FOLDERS, PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { describe, expect, it } from 'vitest'

const createCollection = (overrides: Partial<PromptCollection> = {}): PromptCollection => ({
  id: 'collection',
  kind: 'prompt',
  folderName: 'Collection',
  displayName: 'Collection',
  statusFolders: createPromptStatusFolderLayouts(),
  settings: {
    collectionDescription: ''
  },
  ...overrides
})

describe('isPromptCollectionEmpty', () => {
  it('requires category-order entries, completed prompts, and settings to all be empty', () => {
    expect(isPromptCollectionEmpty(createCollection())).toBe(true)
    expect(
      isPromptCollectionEmpty(
        createCollection({
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
      isPromptCollectionEmpty(
        createCollection({
          statusFolders: createPromptStatusFolderLayouts({
            promptIds: { [PromptStatusFolderId.Completed]: ['completed'] }
          })
        })
      )
    ).toBe(false)
    expect(
      isPromptCollectionEmpty(
        createCollection({
          settings: {
            collectionDescription: 'Description'
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
