import type { PromptFolder } from '@shared/PromptFolder'
import type { EntryRef } from '@shared/OrderContainer'
import { PromptStatus } from '@shared/Prompt'
import { collectCompletedPrompts } from '@renderer/features/prompt-folders/promptFolderCompletedPrompts'
import { describe, expect, it } from 'vitest'

const createFolder = (
  id: string,
  entries: EntryRef[],
  completedPromptIds: string[] = []
): PromptFolder => ({
  id,
  folderName: id,
  displayName: id,
  entries,
  completedPromptIds,
  settings: {
    folderDescription: '',
    folderPrefix: '',
    folderSuffix: ''
  }
})

describe('collectCompletedPrompts', () => {
  it('collects every descendant owner and sorts globally by completion time', () => {
    const grandchild = createFolder('grandchild', [], ['grandchild-completed'])
    const child = createFolder('child', [
      { kind: 'folder', id: grandchild.id }
    ], ['child-completed'])
    const unrelated = createFolder('unrelated', [], ['unrelated-completed'])
    const root = createFolder('root', [
      { kind: 'folder', id: child.id }
    ], ['root-completed'])

    expect(
      collectCompletedPrompts({
        rootFolder: root,
        descendantFolders: [unrelated, grandchild, child],
        statusByPromptId: {
          'root-completed': PromptStatus.Completed,
          'child-completed': PromptStatus.Completed,
          'grandchild-completed': PromptStatus.Completed,
          'unrelated-completed': PromptStatus.Completed
        },
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
    const child = createFolder('child', [
      { kind: 'folder', id: 'root' }
    ], ['child-completed'])
    const root = createFolder('root', [
      { kind: 'folder', id: 'child' }
    ], ['root-completed'])

    expect(
      collectCompletedPrompts({
        rootFolder: root,
        descendantFolders: [child],
        statusByPromptId: {
          'root-completed': PromptStatus.Completed,
          'child-completed': PromptStatus.Completed
        },
        completedAtByPromptId: {
          'root-completed': '2026-07-09T10:00:00.000Z',
          'child-completed': '2026-07-09T11:00:00.000Z'
        }
      })
    ).toHaveLength(2)
  })
})
