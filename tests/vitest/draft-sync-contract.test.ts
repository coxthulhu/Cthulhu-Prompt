import { PromptStatus, type PromptFull, type PromptSummaryData } from '@shared/Prompt'
import type { SystemSettings } from '@shared/SystemSettings'
import { afterEach, describe, expect, it } from 'vitest'
import { promptDraftCollection } from '@renderer/data/Collections/PromptDraftCollection'
import {
  SYSTEM_SETTINGS_FORM_DATA_ID,
  systemSettingsFormDataCollection
} from '@renderer/data/Collections/SystemSettingsFormDataCollection'
import {
  upsertPromptDraft,
  upsertPromptSummaryDrafts
} from '@renderer/data/UiState/PromptDraftMutations.svelte.ts'
import { upsertSystemSettingsFormData } from '@renderer/data/UiState/SystemSettingsFormDataMutations.svelte.ts'

const clearPromptDraftCollection = (): void => {
  const draftIds = Array.from(promptDraftCollection.keys(), (draftId) => String(draftId))
  if (draftIds.length > 0) {
    promptDraftCollection.delete(draftIds)
  }
}

const clearSystemSettingsFormDataCollection = (): void => {
  if (systemSettingsFormDataCollection.get(SYSTEM_SETTINGS_FORM_DATA_ID)) {
    systemSettingsFormDataCollection.delete(SYSTEM_SETTINGS_FORM_DATA_ID)
  }
}

afterEach(() => {
  clearPromptDraftCollection()
  clearSystemSettingsFormDataCollection()
})

const createPrompt = (overrides: Partial<PromptFull> = {}): PromptFull => ({
  id: 'prompt-1',
  title: 'Original title',
  fallbackTitle: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  modifiedAt: '2026-01-01T00:00:00.000Z',
  status: PromptStatus.Todo,
  promptText: 'Original text',
  loadingState: 'full',
  ...overrides
})

const createPromptSummary = (overrides: Partial<PromptSummaryData> = {}): PromptSummaryData => ({
  id: 'prompt-1',
  title: 'Original title',
  fallbackTitle: '',
  modifiedAt: '2026-01-01T00:00:00.000Z',
  status: PromptStatus.Todo,
  ...overrides
})

const createSystemSettings = (overrides: Partial<SystemSettings> = {}): SystemSettings => ({
  promptFontSize: 16,
  promptEditorMinLines: 2,
  promptEditorMaxLines: 30,
  showLineNumbers: true,
  ...overrides
})

describe('draft sync contract', () => {
  it('upserts prompt edit markers without resetting the edited latch', () => {
    const prompt = createPrompt()
    const updatedPrompt = createPrompt({
      title: 'Updated title',
      promptText: 'Updated text'
    })

    upsertPromptDraft(prompt)
    promptDraftCollection.update(prompt.id, (draft) => {
      draft.isEdited = true
    })
    upsertPromptDraft(updatedPrompt)

    const draftRecord = promptDraftCollection.get(prompt.id)!
    expect(draftRecord).toMatchObject({ id: prompt.id, isEdited: true })
    expect(draftRecord).not.toHaveProperty('title')
  })

  it('preserves prompt edit markers across summary hydration', () => {
    const fullPrompt = createPrompt()
    const summaryPrompt = createPromptSummary({ title: 'Updated summary title' })

    upsertPromptDraft(fullPrompt)
    promptDraftCollection.update(fullPrompt.id, (draft) => {
      draft.isEdited = true
    })
    upsertPromptSummaryDrafts([summaryPrompt])

    const draftRecord = promptDraftCollection.get(fullPrompt.id)!
    expect(draftRecord).toMatchObject({ id: fullPrompt.id, isEdited: true })
    expect(draftRecord).not.toHaveProperty('promptText')
  })

  it('seeds prompt edit markers from summary data', () => {
    const summaryPrompt = createPromptSummary({
      id: 'prompt-summary-1',
      title: 'Summary title',
      fallbackTitle: ''
    })

    upsertPromptSummaryDrafts([summaryPrompt])

    const draftRecord = promptDraftCollection.get(summaryPrompt.id)!
    expect(draftRecord).toMatchObject({ id: summaryPrompt.id, isEdited: false })
    expect(draftRecord).not.toHaveProperty('title')
  })

  it('upserts the system-settings form data', () => {
    upsertSystemSettingsFormData(createSystemSettings())

    systemSettingsFormDataCollection.update(SYSTEM_SETTINGS_FORM_DATA_ID, (formDataRecord) => {
      formDataRecord.promptFontSizeInput = '18'
      formDataRecord.promptEditorMinLinesInput = '5'
      formDataRecord.promptEditorMaxLinesInput = '28'
      formDataRecord.showLineNumbers = false
    })

    upsertSystemSettingsFormData(
      createSystemSettings({
        promptFontSize: 19,
        promptEditorMinLines: 6,
        promptEditorMaxLines: 29,
        showLineNumbers: true
      })
    )

    const formDataRecord = systemSettingsFormDataCollection.get(SYSTEM_SETTINGS_FORM_DATA_ID)!
    expect(formDataRecord.promptFontSizeInput).toBe('19')
    expect(formDataRecord.promptEditorMinLinesInput).toBe('6')
    expect(formDataRecord.promptEditorMaxLinesInput).toBe('29')
    expect(formDataRecord.showLineNumbers).toBe(true)
  })
})
