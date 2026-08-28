import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromptSummary, PromptStatus } from '@shared/Prompt'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'

/** IPC spy used to inspect reference-only prompt mutation payloads. */
const ipcInvokeWithPayload = vi.hoisted(() => vi.fn())
/** Revision runner spy exposing optimistic prompt mutation contracts. */
const runRevisionMutation = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/IpcRequestInvoke', () => ({ ipcInvokeWithPayload }))
vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({
  runRevisionMutation,
  mutatePacedRevisionUpdateTransaction: vi.fn(),
  submitPacedUpdateTransactionAndWait: vi.fn()
}))

import { movePrompt, setPromptStatus } from '@renderer/data/Mutations/PromptMutations'

/** Stable prompt used by move and status mutation tests. */
const PROMPT_ID = 'prompt-mutation-test'
/** Stable source folder used by move and status mutation tests. */
const SOURCE_FOLDER_ID = 'prompt-mutation-source'
/** Stable destination folder used by cross-root move tests. */
const DESTINATION_FOLDER_ID = 'prompt-mutation-destination'
/** Stable destination category proving canonical summary metadata is updated. */
const DESTINATION_CATEGORY_ID = 'prompt-mutation-category'

/** Creates one prompt-folder record with the requested active prompts. */
const promptFolder = (
  id: string,
  promptIds: string[] = [],
  categoryId: string | null = null
) => ({
  id,
  kind: 'prompt' as const,
  folderName: id,
  displayName: id,
  completedPromptIds: [],
  categoryOrder: {
    categories: [
      {
        categoryId: null,
        entries: promptIds.map((promptId) => ({ kind: 'prompt' as const, id: promptId }))
      },
      ...(categoryId === null ? [] : [{ categoryId, entries: [] }])
    ]
  },
  settings: { folderDescription: null }
})

describe('prompt mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    promptCollection.utils.deleteAuthoritative(PROMPT_ID)
    promptFolderCollection.utils.deleteAuthoritative(SOURCE_FOLDER_ID)
    promptFolderCollection.utils.deleteAuthoritative(DESTINATION_FOLDER_ID)
    if (promptClientStateCollection.has(PROMPT_ID)) promptClientStateCollection.delete(PROMPT_ID)

    promptCollection.utils.upsertAuthoritative({
      id: PROMPT_ID,
      revision: 3,
      data: createPromptSummary({
        id: PROMPT_ID,
        title: 'Prompt',
        fallbackTitle: '',
        modifiedAt: '2026-08-28T11:00:00.000Z',
        status: PromptStatus.Todo
      })
    })
    promptClientStateCollection.insert({ id: PROMPT_ID, isEdited: false })
    promptFolderCollection.utils.upsertAuthoritative({
      id: SOURCE_FOLDER_ID,
      revision: 2,
      data: promptFolder(SOURCE_FOLDER_ID, [PROMPT_ID])
    })
    promptFolderCollection.utils.upsertAuthoritative({
      id: DESTINATION_FOLDER_ID,
      revision: 4,
      data: promptFolder(DESTINATION_FOLDER_ID, [], DESTINATION_CATEGORY_ID)
    })
    runRevisionMutation.mockResolvedValue(undefined)
    ipcInvokeWithPayload.mockResolvedValue({ success: false, error: 'stop before commit' })
  })

  it('moves canonical prompt state while sending only its revision reference', async () => {
    await movePrompt(
      SOURCE_FOLDER_ID,
      DESTINATION_FOLDER_ID,
      PROMPT_ID,
      null,
      DESTINATION_CATEGORY_ID
    )

    /** Revision mutation options registered by the prompt move. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable source folder receiving the optimistic removal. */
    const source = promptFolder(SOURCE_FOLDER_ID, [PROMPT_ID])
    /** Mutable destination folder receiving the optimistic insertion. */
    const destination = promptFolder(DESTINATION_FOLDER_ID, [], DESTINATION_CATEGORY_ID)
    /** Mutable canonical prompt receiving move-owned metadata. */
    const prompt = structuredClone(promptCollection.get(PROMPT_ID)!)
    /** Prompt client state receiving the edited latch. */
    const promptClientState = { id: PROMPT_ID, isEdited: false }

    options.mutateOptimistically({
      collections: {
        promptFolder: {
          update: (id: string, update: (draft: typeof source) => void) =>
            update(id === SOURCE_FOLDER_ID ? source : destination)
        },
        prompt: {
          update: (_id: string, update: (draft: typeof prompt) => void) => update(prompt)
        },
        promptClientState: {
          update: (_id: string, update: (clientState: typeof promptClientState) => void) =>
            update(promptClientState)
        }
      }
    })

    expect(source.categoryOrder.categories[0]?.entries).toEqual([])
    expect(destination.categoryOrder.categories[1]?.entries).toEqual([
      { kind: 'prompt', id: PROMPT_ID }
    ])
    expect(prompt.category).toBe(DESTINATION_CATEGORY_ID)
    expect(promptClientState).toEqual({ id: PROMPT_ID, isEdited: true })

    /** Revision-aware entity builders used by the shared move payload. */
    const entities = {
      promptFolder: ({ id, data }: { id: string; data: object }) => ({
        id,
        expectedRevision: id === SOURCE_FOLDER_ID ? 2 : 4,
        data
      })
    }
    await options.persistMutations({ entities, transaction: {} })
    expect(ipcInvokeWithPayload).toHaveBeenCalledWith(
      'move-prompt',
      expect.objectContaining({
        content: { id: PROMPT_ID, expectedRevision: 3 }
      })
    )
  })

  it('changes canonical prompt status while latching only the edited marker', async () => {
    await setPromptStatus(
      SOURCE_FOLDER_ID,
      SOURCE_FOLDER_ID,
      PROMPT_ID,
      PromptStatus.Completed
    )

    /** Revision mutation options registered by the prompt status change. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable root folder receiving optimistic status ownership changes. */
    const folder = promptFolder(SOURCE_FOLDER_ID, [PROMPT_ID])
    /** Mutable canonical prompt receiving status fields. */
    const prompt = structuredClone(promptCollection.get(PROMPT_ID)!)
    /** Prompt client state receiving the edited latch. */
    const promptClientState = { id: PROMPT_ID, isEdited: false }

    options.mutateOptimistically({
      collections: {
        promptFolder: {
          update: (_id: string, update: (draft: typeof folder) => void) => update(folder)
        },
        prompt: {
          update: (_id: string, update: (draft: typeof prompt) => void) => update(prompt)
        },
        promptClientState: {
          update: (_id: string, update: (clientState: typeof promptClientState) => void) =>
            update(promptClientState)
        }
      }
    })

    expect(prompt.status).toBe(PromptStatus.Completed)
    expect(prompt).toHaveProperty('completedAt')
    expect(promptClientState).toEqual({ id: PROMPT_ID, isEdited: true })

    /** Root-folder entity builder used by the status request. */
    const entities = {
      promptFolder: ({ id, data }: { id: string; data: object }) => ({
        id,
        expectedRevision: 2,
        data
      })
    }
    await options.persistMutations({ entities, transaction: {} })
    expect(ipcInvokeWithPayload).toHaveBeenCalledWith(
      'set-prompt-status',
      expect.objectContaining({
        prompt: { id: PROMPT_ID, expectedRevision: 3 },
        status: PromptStatus.Completed
      })
    )
  })
})
