import {
  createPromptStatusFolderLayouts,
  type PromptContentFolder
} from '@shared/PromptFolder'
import { PromptStatus, PromptStatusFolderId } from '@shared/Prompt'
import { collectFinalizedPrompts } from '@renderer/features/prompt-folders/promptFolderCompletedPrompts'
import { describe, expect, it } from 'vitest'

const createFolder = (
  id: string,
  finalizedPromptIds: string[] = []
): PromptContentFolder => ({
  id,
  kind: 'prompt',
  folderName: id,
  displayName: id,
  statusFolders: createPromptStatusFolderLayouts({
    promptIds: { [PromptStatusFolderId.Completed]: finalizedPromptIds }
  }),
  settings: {
    folderDescription: ''
  }
})

describe('collectFinalizedPrompts', () => {
  it('collects root-owned prompts and sorts them by completion time', () => {
    const root = createFolder('root', ['older', 'active', 'newer'])

    expect(
      collectFinalizedPrompts({
        rootFolder: root,
        status: PromptStatus.Completed,
        statusByPromptId: {
          older: PromptStatus.Completed,
          active: PromptStatus.Todo,
          newer: PromptStatus.Completed
        },
        finalizedAtByPromptId: {
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
    const finalizedAt = '2026-07-09T11:00:00.000Z'

    expect(
      collectFinalizedPrompts({
        rootFolder: root,
        status: PromptStatus.Completed,
        statusByPromptId: {
          'newest-priority': PromptStatus.Completed,
          'older-priority': PromptStatus.Completed
        },
        finalizedAtByPromptId: {
          'newest-priority': finalizedAt,
          'older-priority': finalizedAt
        }
      })
    ).toEqual([
      { contentOwnerId: 'root', promptId: 'newest-priority' },
      { contentOwnerId: 'root', promptId: 'older-priority' }
    ])
  })
})
