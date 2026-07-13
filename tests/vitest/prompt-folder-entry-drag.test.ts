import { describe, expect, it } from 'vitest'
import type { PromptFolder } from '@shared/PromptFolder'
import { resolvePromptFolderEntryDropMove } from '@renderer/features/drag-drop/promptFolderEntryDrag'

const folder = (id: string, entries: PromptFolder['entries'] = []): PromptFolder => ({
  id,
  folderName: id,
  displayName: id,
  entries,
  completedPromptIds: [],
  settings: { folderDescription: '', folderPrefix: '', folderSuffix: '' }
})

const activeEntryIds = (promptFolder: PromptFolder): string[] =>
  promptFolder.entries.map((entry) => entry.id)

describe('resolvePromptFolderEntryDropMove', () => {
  it('moves a subfolder before and after mixed sibling entries', () => {
    const child = folder('child')
    const root = folder('root', [
      { kind: 'prompt', id: 'first' },
      { kind: 'folder', id: child.id },
      { kind: 'prompt', id: 'last' }
    ])

    expect(
      resolvePromptFolderEntryDropMove([root, child], activeEntryIds, child.id, {
        folderId: root.id,
        targetEntryId: 'first',
        position: 'before'
      })
    ).toMatchObject({ previousEntryId: null })
    expect(
      resolvePromptFolderEntryDropMove([root, child], activeEntryIds, child.id, {
        folderId: root.id,
        targetEntryId: 'last',
        position: 'after'
      })
    ).toMatchObject({ previousEntryId: 'last' })
  })

  it('rejects no-op, self, descendant, and excessive-depth moves', () => {
    const folders = Array.from({ length: 9 }, (_, index) => folder(`folder-${index}`))
    for (let index = 0; index < folders.length - 1; index += 1) {
      folders[index].entries = [{ kind: 'folder', id: folders[index + 1].id }]
    }

    expect(
      resolvePromptFolderEntryDropMove(folders, activeEntryIds, 'folder-1', {
        folderId: 'folder-0',
        targetEntryId: null,
        position: 'after'
      })
    ).toBeNull()
    expect(
      resolvePromptFolderEntryDropMove(folders, activeEntryIds, 'folder-1', {
        folderId: 'folder-1',
        targetEntryId: null,
        position: 'after'
      })
    ).toBeNull()
    expect(
      resolvePromptFolderEntryDropMove(folders, activeEntryIds, 'folder-1', {
        folderId: 'folder-2',
        targetEntryId: null,
        position: 'after'
      })
    ).toBeNull()

    const shallow = folder('shallow')
    const sourceRoot = folder('source-root', [{ kind: 'folder', id: shallow.id }])
    expect(
      resolvePromptFolderEntryDropMove(
        [...folders, sourceRoot, shallow],
        activeEntryIds,
        shallow.id,
        {
        folderId: 'folder-8',
        targetEntryId: null,
        position: 'after'
        }
      )
    ).toBeNull()
  })
})
