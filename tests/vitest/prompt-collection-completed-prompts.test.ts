import {
  createPromptStatusFolderLayouts,
  type PromptContentCollection
} from '@shared/domain/prompt-collection/PromptCollection'
import { PromptStatus, PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { collectFinalizedPrompts } from '@renderer/features/prompt-collections/promptCollectionCompletedPrompts'
import { describe, expect, it } from 'vitest'

const createCollection = (
  id: string,
  finalizedPromptIds: string[] = []
): PromptContentCollection => ({
  id,
  kind: 'prompt',
  folderName: id,
  displayName: id,
  statusFolders: createPromptStatusFolderLayouts({
    promptIds: { [PromptStatusFolderId.Completed]: finalizedPromptIds }
  }),
  settings: {
    collectionDescription: ''
  }
})

describe('collectFinalizedPrompts', () => {
  it('collects root-owned prompts and sorts them by completion time', () => {
    const root = createCollection('root', ['older', 'active', 'newer'])

    expect(
      collectFinalizedPrompts({
        collection: root,
        statusFolderId: PromptStatusFolderId.Completed,
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
    const root = createCollection('root', ['newest-priority', 'older-priority'])
    /** Equal persisted timestamp proving ID order is the deterministic tie-breaker. */
    const finalizedAt = '2026-07-09T11:00:00.000Z'

    expect(
      collectFinalizedPrompts({
        collection: root,
        statusFolderId: PromptStatusFolderId.Completed,
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
