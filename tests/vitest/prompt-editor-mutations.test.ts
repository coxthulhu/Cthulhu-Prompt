import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromptFull, PromptStatus } from '@shared/Prompt'
import { createPromptTemplateFull } from '@shared/PromptTemplate'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'

/** Paced mutation spy exposing authoritative editor update recipes. */
const mutatePacedRevisionUpdateTransaction = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation: vi.fn(),
  submitPacedUpdateTransactionAndWait: vi.fn()
}))

import {
  setPromptTemplates,
  setPromptText,
  setPromptTitle
} from '@renderer/data/UiState/PromptDraftMutations.svelte.ts'
import {
  setPromptTemplateText,
  setPromptTemplateTitle
} from '@renderer/data/UiState/PromptTemplateDraftMutations.svelte.ts'

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
  })

  it('updates canonical prompt fields while keeping the draft marker-only', () => {
    /** Mutable canonical prompt receiving the optimistic setter recipes. */
    const prompt = structuredClone(promptCollection.get(PROMPT_ID)!)
    /** Marker-only prompt draft receiving the shared edited latch. */
    const promptDraft = { id: PROMPT_ID, isEdited: false }
    /** Optimistic collections used to apply each registered prompt setter recipe. */
    const collections = {
      prompt: {
        update: (_id: string, update: (draft: typeof prompt) => void) => update(prompt)
      },
      promptDraft: {
        update: (_id: string, update: (draft: typeof promptDraft) => void) =>
          update(promptDraft)
      }
    }

    setPromptTitle(PROMPT_ID, 'Updated Prompt')
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
    })
    setPromptText(PROMPT_ID, 'Updated prompt text.', MEASUREMENT)
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
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
    expect(promptDraft).toEqual({ id: PROMPT_ID, isEdited: true })
  })

  it('updates canonical template fields while keeping the draft marker-only', () => {
    /** Mutable canonical template receiving the optimistic setter recipes. */
    const template = structuredClone(promptTemplateCollection.get(TEMPLATE_ID)!)
    /** Marker-only template draft receiving the shared edited latch. */
    const templateDraft = { id: TEMPLATE_ID, isEdited: false }
    /** Optimistic collections used to apply each registered template setter recipe. */
    const collections = {
      promptTemplate: {
        update: (_id: string, update: (draft: typeof template) => void) => update(template)
      },
      promptTemplateDraft: {
        update: (_id: string, update: (draft: typeof templateDraft) => void) =>
          update(templateDraft)
      }
    }

    setPromptTemplateTitle(TEMPLATE_ID, 'Updated Template')
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
    })
    setPromptTemplateText(TEMPLATE_ID, 'Updated template text.', MEASUREMENT)
    mutatePacedRevisionUpdateTransaction.mock.calls.at(-1)?.[0].mutateOptimistically({
      collections
    })

    expect(template).toMatchObject({
      title: 'Updated Template',
      templateText: 'Updated template text.'
    })
    expect(templateDraft).toEqual({ id: TEMPLATE_ID, isEdited: true })
  })
})
