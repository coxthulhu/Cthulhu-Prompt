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
      { contentOwnerId: 'root', promptId: 'newer' },
      { contentOwnerId: 'root', promptId: 'older' }
    ])
  })

  it('retains completed ID priority when completion timestamps tie', () => {
    /** Completed-ID order with the newest mutation already placed first. */
    const root = createFolder('root', ['newest-priority', 'older-priority'])
    /** Equal persisted timestamp proving ID order is the deterministic tie-breaker. */
    const completedAt = '2026-07-09T11:00:00.000Z'

    expect(
      collectCompletedPrompts({
        rootFolder: root,
        statusByPromptId: {
          'newest-priority': PromptStatus.Completed,
          'older-priority': PromptStatus.Completed
        },
        completedAtByPromptId: {
          'newest-priority': completedAt,
          'older-priority': completedAt
        }
      })
    ).toEqual([
      { contentOwnerId: 'root', promptId: 'newest-priority' },
      { contentOwnerId: 'root', promptId: 'older-priority' }
    ])
  })
})
