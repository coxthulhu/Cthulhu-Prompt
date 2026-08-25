import { describe, expect, it } from 'vitest'
import { insertCategoryOrderEntry, moveCategoryOrderGroup } from '@shared/PromptFolder'
import type { PromptFolder } from '@shared/PromptFolder'
import { PromptStatus } from '@shared/Prompt'
import {
  resolveCategoryDropPreviousCategoryId,
  resolvePromptHandleDropMove
} from '@renderer/features/drag-drop/promptHandleDrag'
import { resolvePromptTreePromptMove } from '@renderer/features/sidebar/promptTreeDrag'

describe('category ordering and drag placement', () => {
  it('moves content between exact groups and places it at the requested position', () => {
    const order = {
      categories: [
        { categoryId: null, entries: [{ kind: 'prompt' as const, id: 'root-prompt' }] },
        {
          categoryId: 'category-a',
          entries: [
            { kind: 'prompt' as const, id: 'a-1' },
            { kind: 'prompt' as const, id: 'a-2' }
          ]
        }
      ]
    }

    expect(
      insertCategoryOrderEntry(order, { kind: 'prompt', id: 'root-prompt' }, 'category-a', 'a-1')
    ).toEqual({
      categories: [
        { categoryId: null, entries: [] },
        {
          categoryId: 'category-a',
          entries: [
            { kind: 'prompt', id: 'a-1' },
            { kind: 'prompt', id: 'root-prompt' },
            { kind: 'prompt', id: 'a-2' }
          ]
        }
      ]
    })
  })

  it('keeps Uncategorized fixed while moving a category with all of its entries', () => {
    const order = {
      categories: [
        { categoryId: null, entries: [] },
        { categoryId: 'category-a', entries: [{ kind: 'prompt' as const, id: 'a' }] },
        { categoryId: 'category-b', entries: [{ kind: 'prompt' as const, id: 'b' }] }
      ]
    }

    expect(moveCategoryOrderGroup(order, 'category-b', null).categories).toEqual([
      { categoryId: null, entries: [] },
      { categoryId: 'category-b', entries: [{ kind: 'prompt', id: 'b' }] },
      { categoryId: 'category-a', entries: [{ kind: 'prompt', id: 'a' }] }
    ])
  })

  it('resolves category boundaries before headers and at the bottom', () => {
    /** Stable category order shared by the boundary assertions. */
    const categoryIds = ['category-a', 'category-b', 'category-c']

    expect(
      resolveCategoryDropPreviousCategoryId(categoryIds, 'category-c', 'category-a')
    ).toBeNull()
    expect(
      resolveCategoryDropPreviousCategoryId(categoryIds, 'category-a', 'category-c')
    ).toBe('category-b')
    expect(resolveCategoryDropPreviousCategoryId(categoryIds, 'category-a', null)).toBe(
      'category-c'
    )
  })

  it('rejects category boundaries that preserve the current order', () => {
    /** Stable category order used by the no-op boundary assertions. */
    const categoryIds = ['category-a', 'category-b', 'category-c']

    expect(
      resolveCategoryDropPreviousCategoryId(categoryIds, 'category-b', 'category-c')
    ).toBeUndefined()
    expect(
      resolveCategoryDropPreviousCategoryId(categoryIds, 'category-c', null)
    ).toBeUndefined()
  })

  it('resolves a category change but rejects a same-position drop', () => {
    expect(
      resolvePromptHandleDropMove(
        'category-a',
        ['prompt-a'],
        'prompt-a',
        {
          folderId: 'category-b',
          categoryId: 'category-b',
          targetEntryId: null,
          position: 'after',
          statusSection: 'active'
        },
        []
      )
    ).toMatchObject({ categoryId: 'category-b', previousEntryId: null })
    expect(
      resolvePromptHandleDropMove(
        'category-a',
        ['prompt-a'],
        'prompt-a',
        {
          folderId: 'category-a',
          categoryId: 'category-a',
          targetEntryId: null,
          position: 'after',
          statusSection: 'active'
        },
        ['prompt-a']
      )
    ).toBeNull()
  })

  it('resolves cross-status drops without treating completed ordering as active ordering', () => {
    /** Prompt folder shared by both status sections in the sidebar. */
    const promptFolder: PromptFolder = {
      id: 'root-folder',
      kind: 'prompt',
      folderName: 'Root',
      displayName: 'Root',
      completedPromptIds: ['completed-prompt'],
      settings: { folderDescription: null },
      categoryOrder: {
        categories: [
          {
            categoryId: null,
            entries: [
              { kind: 'prompt', id: 'active-first' },
              { kind: 'prompt', id: 'active-second' }
            ]
          }
        ]
      }
    }

    expect(
      resolvePromptTreePromptMove(
        [promptFolder],
        {
          fromId: 'active-first',
          sourceFolderId: promptFolder.id,
          sourceCategoryId: null,
          contentKind: 'prompt',
          statusSection: 'active'
        },
        {
          folderId: promptFolder.id,
          categoryId: null,
          targetEntryId: 'completed-prompt',
          position: 'after',
          statusSection: 'completed'
        }
      )
    ).toMatchObject({
      move: { promptId: 'active-first', categoryId: null, previousEntryId: null },
      targetStatus: PromptStatus.Completed
    })

    expect(
      resolvePromptTreePromptMove(
        [promptFolder],
        {
          fromId: 'completed-prompt',
          sourceFolderId: promptFolder.id,
          sourceCategoryId: null,
          contentKind: 'prompt',
          statusSection: 'completed'
        },
        {
          folderId: promptFolder.id,
          categoryId: null,
          targetEntryId: 'active-second',
          position: 'before',
          statusSection: 'active'
        }
      )
    ).toMatchObject({
      move: {
        promptId: 'completed-prompt',
        categoryId: null,
        previousEntryId: 'active-first'
      },
      targetStatus: PromptStatus.Todo
    })
  })

  it('rejects same-tree completed drops', () => {
    /** Minimal prompt folder used to prove Completed ordering never changes. */
    const promptFolder: PromptFolder = {
      id: 'root-folder',
      kind: 'prompt',
      folderName: 'Root',
      displayName: 'Root',
      completedPromptIds: ['completed-first', 'completed-second'],
      settings: { folderDescription: null },
      categoryOrder: { categories: [{ categoryId: null, entries: [] }] }
    }

    expect(
      resolvePromptTreePromptMove(
        [promptFolder],
        {
          fromId: 'completed-first',
          sourceFolderId: promptFolder.id,
          contentKind: 'prompt',
          statusSection: 'completed'
        },
        {
          folderId: promptFolder.id,
          targetEntryId: 'completed-second',
          position: 'after',
          statusSection: 'completed'
        }
      )
    ).toBeNull()
  })
})
