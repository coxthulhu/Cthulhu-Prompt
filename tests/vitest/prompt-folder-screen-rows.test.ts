import type { Category } from '@shared/Category'
import type { PromptFolder } from '@shared/PromptFolder'
import {
  buildPromptFolderScreenRows,
  type PromptFolderScreenRow
} from '@renderer/features/prompt-folders/promptFolderScreenRows'
import { describe, expect, it } from 'vitest'

/** Creates one root folder with exact Uncategorized and category groups. */
const createFolder = (
  groups: Array<{ categoryId: string | null; promptIds: string[] }>
): PromptFolder => ({
  id: 'folder-root',
  kind: 'prompt',
  folderName: 'Root',
  displayName: 'Root',
  completedPromptIds: [],
  categoryOrder: {
    categories: groups.map((group) => ({
      categoryId: group.categoryId,
      entries: group.promptIds.map((id) => ({ kind: 'prompt', id }))
    }))
  },
  settings: { folderDescription: null }
})

/** Creates loaded category metadata for row projection. */
const category = (id: string): Category => ({ id, displayName: id, description: null })

/** Projects a folder with selected collapsed category IDs. */
const buildRows = (
  rootFolder: PromptFolder,
  categories: Category[],
  promptIds: string[],
  collapsedCategoryIds: string[] = []
): PromptFolderScreenRow[] => {
  const collapsed = new Set(collapsedCategoryIds)
  return buildPromptFolderScreenRows({
    rootFolder,
    categories,
    promptIds,
    isCategoryExpanded: (categoryId) => !collapsed.has(categoryId)
  })
}

describe('buildPromptFolderScreenRows', () => {
  it('shows Uncategorized first without a header and categories in V2 order', () => {
    const rows = buildRows(
      createFolder([
        { categoryId: null, promptIds: ['root-prompt'] },
        { categoryId: 'category-a', promptIds: ['a-prompt'] },
        { categoryId: 'category-b', promptIds: ['b-prompt'] }
      ]),
      [category('category-a'), category('category-b')],
      ['root-prompt', 'a-prompt', 'b-prompt']
    )

    expect(
      rows.flatMap((row) =>
        row.kind === 'category-editor'
          ? [`category:${row.categoryId}`]
          : row.kind === 'category-separator'
            ? [`separator:${row.categoryId}`]
          : row.kind === 'prompt-editor'
            ? [`prompt:${row.promptId}:${row.categoryId ?? 'uncategorized'}`]
            : []
      )
    ).toEqual([
      'prompt:root-prompt:uncategorized',
      'category:category-a',
      'prompt:a-prompt:category-a',
      'separator:category-a',
      'category:category-b',
      'prompt:b-prompt:category-b',
      'separator:category-b'
    ])
  })

  it('emits an Uncategorized divider and placeholder for an empty root', () => {
    const rows = buildRows(createFolder([{ categoryId: null, promptIds: [] }]), [], [])

    expect(rows.map((row) => row.kind)).toEqual(['root-header', 'prompt-divider', 'placeholder'])
    expect(rows[1]).toMatchObject({ categoryId: null, contentOwnerId: 'folder-root' })
  })

  it('renders an empty category without adding a nested placeholder', () => {
    const rows = buildRows(
      createFolder([
        { categoryId: null, promptIds: [] },
        { categoryId: 'category-a', promptIds: [] }
      ]),
      [category('category-a')],
      []
    )

    expect(rows.filter((row) => row.kind === 'placeholder')).toEqual([])
    expect(rows).toContainEqual(
      expect.objectContaining({ kind: 'prompt-divider', categoryId: 'category-a' })
    )
    expect(rows.at(-1)).toEqual({ kind: 'category-separator', categoryId: 'category-a' })
  })

  it('replaces a collapsed category contents with its prompt summary', () => {
    const rows = buildRows(
      createFolder([
        { categoryId: null, promptIds: [] },
        { categoryId: 'category-a', promptIds: ['a-1', 'a-2'] }
      ]),
      [category('category-a')],
      ['a-1', 'a-2'],
      ['category-a']
    )

    expect(rows).toContainEqual(
      expect.objectContaining({
        kind: 'collapsed-summary',
        categoryId: 'category-a',
        promptCount: 2
      })
    )
    expect(rows).not.toContainEqual(
      expect.objectContaining({ kind: 'prompt-editor', categoryId: 'category-a' })
    )
    expect(rows.at(-1)).toEqual({ kind: 'category-separator', categoryId: 'category-a' })
  })

  it('ignores category groups whose metadata is not loaded', () => {
    const rows = buildRows(
      createFolder([
        { categoryId: null, promptIds: [] },
        { categoryId: 'missing', promptIds: ['missing-prompt'] }
      ]),
      [],
      ['missing-prompt']
    )

    expect(rows.map((row) => row.kind)).toEqual(['root-header', 'prompt-divider', 'placeholder'])
  })
})
