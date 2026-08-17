import { describe, expect, it } from 'vitest'
import { insertCategoryOrderEntry, moveCategoryOrderGroup } from '@shared/PromptFolder'
import { resolvePromptHandleDropMove } from '@renderer/features/drag-drop/promptHandleDrag'

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
          position: 'after'
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
          position: 'after'
        },
        ['prompt-a']
      )
    ).toBeNull()
  })
})
