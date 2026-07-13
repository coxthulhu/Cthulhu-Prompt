import type { PromptFolder } from '@shared/PromptFolder'
import type { EntryRef } from '@shared/OrderContainer'
import { PromptStatus } from '@shared/Prompt'
import { collectCompletedPrompts } from '@renderer/features/prompt-folders/promptFolderCompletedPrompts'
import { describe, expect, it } from 'vitest'

const createFolder = (
  id: string,
  entries: EntryRef[]
): PromptFolder => ({
  id,
  folderName: id,
  displayName: id,
  entries,
  settings: {
    folderDescription: '',
    folderPrefix: '',
    folderSuffix: ''
  }
})

describe('collectCompletedPrompts', () => {
  it('collects every descendant owner and sorts globally by completion time', () => {
    const grandchild = createFolder('grandchild', [
      { kind: 'prompt', id: 'grandchild-completed' }
    ])
    const child = createFolder('child', [
      { kind: 'prompt', id: 'child-completed' },
      { kind: 'folder', id: grandchild.id }
    ])
    const unrelated = createFolder('unrelated', [
      { kind: 'prompt', id: 'unrelated-completed' }
    ])
    const root = createFolder('root', [
      { kind: 'prompt', id: 'root-completed' },
      { kind: 'folder', id: child.id }
    ])

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
      { kind: 'prompt', id: 'child-completed' },
      { kind: 'folder', id: 'root' }
    ])
    const root = createFolder('root', [
      { kind: 'prompt', id: 'root-completed' },
      { kind: 'folder', id: 'child' }
    ])

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
