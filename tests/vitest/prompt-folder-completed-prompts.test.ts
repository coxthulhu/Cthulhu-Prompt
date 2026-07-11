import type { PromptFolder } from '@shared/PromptFolder'
import { collectCompletedPrompts } from '@renderer/features/prompt-folders/promptFolderCompletedPrompts'
import { describe, expect, it } from 'vitest'

const createFolder = (
  id: string,
  entryIds: string[],
  completedPromptIds: string[],
  parentPromptFolderId: string | null,
  depth: number
): PromptFolder => ({
  id,
  folderName: id,
  displayName: id,
  parentPromptFolderId,
  depth,
  modifiedAt: null,
  promptCount: 0,
  entryIds,
  completedPromptIds,
  settings: {
    folderDescription: '',
    folderPrefix: '',
    folderSuffix: ''
  }
})

describe('collectCompletedPrompts', () => {
  it('collects every descendant owner and sorts globally by completion time', () => {
    const grandchild = createFolder(
      'grandchild',
      [],
      ['grandchild-completed'],
      'child',
      2
    )
    const child = createFolder(
      'child',
      [grandchild.id],
      ['child-completed'],
      'root',
      1
    )
    const unrelated = createFolder('unrelated', [], ['unrelated-completed'], null, 0)
    const root = createFolder('root', [child.id], ['root-completed'], null, 0)

    expect(
      collectCompletedPrompts({
        rootFolder: root,
        descendantFolders: [unrelated, grandchild, child],
        completedAtByPromptId: {
          'root-completed': '2026-07-09T10:00:00.000Z',
          'child-completed': '2026-07-09T12:00:00.000Z',
          'grandchild-completed': '2026-07-09T11:00:00.000Z',
          'unrelated-completed': '2026-07-09T13:00:00.000Z'
        }
      })
    ).toEqual([
      { ownerFolderId: 'child', promptId: 'child-completed' },
      { ownerFolderId: 'grandchild', promptId: 'grandchild-completed' },
      { ownerFolderId: 'root', promptId: 'root-completed' }
    ])
  })

  it('visits a malformed folder graph only once', () => {
    const child = createFolder('child', ['root'], ['child-completed'], 'root', 1)
    const root = createFolder('root', ['child'], ['root-completed'], null, 0)

    expect(
      collectCompletedPrompts({
        rootFolder: root,
        descendantFolders: [child],
        completedAtByPromptId: {}
      })
    ).toHaveLength(2)
  })
})
