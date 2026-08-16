import type { PromptFolder } from '@shared/PromptFolder'
import { PromptStatus } from '@shared/Prompt'
import { collectCompletedPrompts } from '@renderer/features/prompt-folders/promptFolderCompletedPrompts'
import { describe, expect, it } from 'vitest'

const createFolder = (
  id: string,
  completedPromptIds: string[] = []
): PromptFolder => ({
  id,
  kind: 'prompt',
  folderName: id,
  displayName: id,
  entries: [],
  completedPromptIds,
  categoryOrder: { categories: [{ categoryId: null, entries: [] }] },
  settings: {
    folderDescription: ''
  }
})

describe('collectCompletedPrompts', () => {
  it('collects root-owned prompts and sorts them by completion time', () => {
    const root = createFolder('root', ['older', 'active', 'newer'])

    expect(
      collectCompletedPrompts({
        rootFolder: root,
        statusByPromptId: {
          older: PromptStatus.Completed,
          active: PromptStatus.Todo,
          newer: PromptStatus.Completed
        },
        completedAtByPromptId: {
          older: '2026-07-09T10:00:00.000Z',
          newer: '2026-07-09T11:00:00.000Z'
        }
      })
    ).toEqual([
      { ownerFolderId: 'root', promptId: 'newer' },
      { ownerFolderId: 'root', promptId: 'older' }
    ])
  })
})
