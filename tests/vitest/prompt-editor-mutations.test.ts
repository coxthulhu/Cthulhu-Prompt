import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromptFull, PromptStatus } from '@shared/Prompt'
import { createPromptTemplateFull } from '@shared/PromptTemplate'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'

/** Paced mutation spy exposing authoritative editor update recipes. */
const mutatePacedRevisionUpdateTransaction = vi.hoisted(() => vi.fn())
/** Stable transaction identity returned by the paced mutation mock. */
const pacedTransaction = {}

vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation: vi.fn(),
  submitPacedUpdateTransactionAndWait: vi.fn()
}))

import {
  setPromptTemplates,
  setPromptText,
  setPromptTitle
} from '@renderer/data/UiState/PromptClientStateMutations.svelte.ts'
import {
  setPromptTemplateText,
  setPromptTemplateTitle
} from '@renderer/data/UiState/PromptTemplateClientStateMutations.svelte.ts'

/** Stable prompt edited through the renamed canonical setter APIs. */
const PROMPT_ID = 'prompt-editor-mutation'
/** Stable template edited through the renamed canonical setter APIs. */
const TEMPLATE_ID = 'template-editor-mutation'
/** Editor measurement supplied to prompt and template text setters. */
const MEASUREMENT = { measuredHeightPx: 100, widthPx: 500, devicePixelRatio: 1 }

describe('prompt editor mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    promptCollection.utils.deleteAuthoritative(PROMPT_ID)
    promptTemplateCollection.utils.deleteAuthoritative(TEMPLATE_ID)
    promptFolderCollection.utils.deleteAuthoritative('prompt-editor-root')
    promptFolderCollection.utils.deleteAuthoritative('template-editor-root')
    mutatePacedRevisionUpdateTransaction.mockReturnValue(pacedTransaction)
    promptCollection.utils.upsertAuthoritative({
      id: PROMPT_ID,
      revision: 1,
      data: createPromptFull({
        id: PROMPT_ID,
        title: 'Original Prompt',
        fallbackTitle: '',
        createdAt: '2026-08-28T10:00:00.000Z',
        modifiedAt: '2026-08-28T11:00:00.000Z',
        promptText: 'Original prompt text.',
        status: PromptStatus.Todo
      })
    })
    promptTemplateCollection.utils.upsertAuthoritative({
      id: TEMPLATE_ID,
      revision: 1,
      data: createPromptTemplateFull({
        id: TEMPLATE_ID,
        title: 'Original Template',
        fallbackTitle: '',
        createdAt: '2026-08-28T10:00:00.000Z',
        modifiedAt: '2026-08-28T11:00:00.000Z',
        templateText: 'Original template text.'
      })
    })
    promptFolderCollection.utils.upsertAuthoritative({
      id: 'prompt-editor-root',
      revision: 1,
      data: {
        id: 'prompt-editor-root',
        kind: 'prompt',
        folderName: 'Prompts',
        displayName: 'Prompts',
        completedPromptIds: [],
        categoryOrder: {
          categories: [{ categoryId: null, entries: [{ kind: 'prompt', id: PROMPT_ID }] }]
        },
        settings: { folderDescription: null }
      }
    })
    promptFolderCollection.utils.upsertAuthoritative({
      id: 'template-editor-root',
      revision: 1,
      data: {
        id: 'template-editor-root',
        kind: 'template',
        folderName: 'Templates',
        displayName: 'Templates',
        completedPromptIds: [],
        categoryOrder: {
          categories: [
            { categoryId: null, entries: [{ kind: 'template', id: TEMPLATE_ID }] }
          ]
        },
        settings: { folderDescription: null }
      }
    })
  })

  it('updates canonical prompt fields while keeping client state marker-only', () => {
    /** Mutable canonical prompt receiving the optimistic setter recipes. */
    const prompt = structuredClone(promptCollection.get(PROMPT_ID)!)
    /** Marker-only prompt client state receiving the shared edited latch. */
    const promptClientState = { id: PROMPT_ID, isEdited: false }
    /** Optimistic collections used to apply each registered prompt setter recipe. */
    const collections = {
      prompt: {
        update: (_id: string, update: (draft: typeof prompt) => void) => update(prompt)
      },
      promptClientState: {
        update: (_id: string, update: (clientState: typeof promptClientState) => void) =>
          update(promptClientState)
      }
    }

    setPromptTitle(PROMPT_ID, 'Updated Prompt')
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
    })
    promptCollection.utils.upsertAuthoritative({
      id: PROMPT_ID,
      revision: 2,
      data: createPromptFull({
        id: PROMPT_ID,
        title: 'Updated Prompt',
        fallbackTitle: '',
        createdAt: '2026-08-28T10:00:00.000Z',
        modifiedAt: prompt.modifiedAt,
        promptText: 'Original prompt text.',
        status: PromptStatus.Todo
      })
    })
    setPromptText(PROMPT_ID, 'Updated prompt text.', MEASUREMENT)
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
    })
    promptCollection.utils.upsertAuthoritative({
      id: PROMPT_ID,
      revision: 3,
      data: createPromptFull({
        id: PROMPT_ID,
        title: 'Updated Prompt',
        fallbackTitle: '',
        createdAt: '2026-08-28T10:00:00.000Z',
        modifiedAt: prompt.modifiedAt,
        promptText: 'Updated prompt text.',
        status: PromptStatus.Todo
      })
    })
    setPromptTemplates(PROMPT_ID, [{ id: TEMPLATE_ID }])
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
    })

    expect(prompt).toMatchObject({
      title: 'Updated Prompt',
      promptText: 'Updated prompt text.',
      templates: [{ id: TEMPLATE_ID }]
    })
    expect(promptClientState).toEqual({ id: PROMPT_ID, isEdited: true })
  })

  it('updates canonical template fields while keeping client state marker-only', () => {
    /** Mutable canonical template receiving the optimistic setter recipes. */
    const template = structuredClone(promptTemplateCollection.get(TEMPLATE_ID)!)
    /** Marker-only template client state receiving the shared edited latch. */
    const templateClientState = { id: TEMPLATE_ID, isEdited: false }
    /** Optimistic collections used to apply each registered template setter recipe. */
    const collections = {
      promptTemplate: {
        update: (_id: string, update: (draft: typeof template) => void) => update(template)
      },
      promptTemplateClientState: {
        update: (_id: string, update: (clientState: typeof templateClientState) => void) =>
          update(templateClientState)
      }
    }

    setPromptTemplateTitle(TEMPLATE_ID, 'Updated Template')
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
    })
    promptTemplateCollection.utils.upsertAuthoritative({
      id: TEMPLATE_ID,
      revision: 2,
      data: createPromptTemplateFull({
        id: TEMPLATE_ID,
        title: 'Updated Template',
        fallbackTitle: '',
        createdAt: '2026-08-28T10:00:00.000Z',
        modifiedAt: template.modifiedAt,
        templateText: 'Original template text.'
      })
    })
    setPromptTemplateText(TEMPLATE_ID, 'Updated template text.', MEASUREMENT)
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
    })

    expect(template).toMatchObject({
      title: 'Updated Template',
      templateText: 'Updated template text.'
    })
    expect(templateClientState).toEqual({ id: TEMPLATE_ID, isEdited: true })
  })
})
