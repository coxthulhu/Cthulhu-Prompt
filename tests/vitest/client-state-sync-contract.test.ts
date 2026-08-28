import { PromptStatus, type PromptFull, type PromptSummaryData } from '@shared/Prompt'
import type { SystemSettings } from '@shared/SystemSettings'
import { afterEach, describe, expect, it } from 'vitest'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import {
  SYSTEM_SETTINGS_CLIENT_STATE_ID,
  systemSettingsClientStateCollection
} from '@renderer/data/Collections/SystemSettingsClientStateCollection'
import {
  upsertPromptClientState,
  upsertPromptClientStates
} from '@renderer/data/UiState/PromptClientStateMutations.svelte.ts'
import { upsertSystemSettingsClientState } from '@renderer/data/UiState/SystemSettingsClientStateMutations.svelte.ts'

/** Clears prompt client state between contract tests. */
const clearPromptClientStateCollection = (): void => {
  const clientStateIds = Array.from(promptClientStateCollection.keys(), (id) => String(id))
  if (clientStateIds.length > 0) {
    promptClientStateCollection.delete(clientStateIds)
  }
}

/** Clears system-settings client state between contract tests. */
const clearSystemSettingsClientStateCollection = (): void => {
  if (systemSettingsClientStateCollection.get(SYSTEM_SETTINGS_CLIENT_STATE_ID)) {
    systemSettingsClientStateCollection.delete(SYSTEM_SETTINGS_CLIENT_STATE_ID)
  }
}

afterEach(() => {
  clearPromptClientStateCollection()
  clearSystemSettingsClientStateCollection()
})

/** Creates one full prompt for client-state hydration tests. */
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

/** Creates one prompt summary for client-state hydration tests. */
const createPromptSummary = (overrides: Partial<PromptSummaryData> = {}): PromptSummaryData => ({
  id: 'prompt-1',
  title: 'Original title',
  fallbackTitle: '',
  modifiedAt: '2026-01-01T00:00:00.000Z',
  status: PromptStatus.Todo,
  ...overrides
})

/** Creates authoritative settings for client-state hydration tests. */
const createSystemSettings = (overrides: Partial<SystemSettings> = {}): SystemSettings => ({
  promptFontSize: 16,
  promptEditorMinLines: 2,
  promptEditorMaxLines: 30,
  showLineNumbers: true,
  ...overrides
})

describe('client-state sync contract', () => {
  it('upserts prompt edit markers without resetting the edited latch', () => {
    const prompt = createPrompt()
    const updatedPrompt = createPrompt({
      title: 'Updated title',
      promptText: 'Updated text'
    })

    upsertPromptClientState(prompt)
    promptClientStateCollection.update(prompt.id, (clientState) => {
      clientState.isEdited = true
    })
    upsertPromptClientState(updatedPrompt)

    const clientState = promptClientStateCollection.get(prompt.id)!
    expect(clientState).toMatchObject({ id: prompt.id, isEdited: true })
    expect(clientState).not.toHaveProperty('title')
  })

  it('preserves prompt edit markers across summary hydration', () => {
    const fullPrompt = createPrompt()
    const summaryPrompt = createPromptSummary({ title: 'Updated summary title' })

    upsertPromptClientState(fullPrompt)
    promptClientStateCollection.update(fullPrompt.id, (clientState) => {
      clientState.isEdited = true
    })
    upsertPromptClientStates([summaryPrompt])

    const clientState = promptClientStateCollection.get(fullPrompt.id)!
    expect(clientState).toMatchObject({ id: fullPrompt.id, isEdited: true })
    expect(clientState).not.toHaveProperty('promptText')
  })

  it('seeds prompt edit markers from summary data', () => {
    const summaryPrompt = createPromptSummary({
      id: 'prompt-summary-1',
      title: 'Summary title',
      fallbackTitle: ''
    })

    upsertPromptClientStates([summaryPrompt])

    const clientState = promptClientStateCollection.get(summaryPrompt.id)!
    expect(clientState).toMatchObject({ id: summaryPrompt.id, isEdited: false })
    expect(clientState).not.toHaveProperty('title')
  })

  it('upserts system-settings client state', () => {
    upsertSystemSettingsClientState(createSystemSettings())

    systemSettingsClientStateCollection.update(SYSTEM_SETTINGS_CLIENT_STATE_ID, (clientState) => {
      clientState.promptFontSizeInput = '18'
      clientState.promptEditorMinLinesInput = '5'
      clientState.promptEditorMaxLinesInput = '28'
      clientState.showLineNumbers = false
    })

    upsertSystemSettingsClientState(
      createSystemSettings({
        promptFontSize: 19,
        promptEditorMinLines: 6,
        promptEditorMaxLines: 29,
        showLineNumbers: true
      })
    )

    const clientState = systemSettingsClientStateCollection.get(
      SYSTEM_SETTINGS_CLIENT_STATE_ID
    )!
    expect(clientState.promptFontSizeInput).toBe('19')
    expect(clientState.promptEditorMinLinesInput).toBe('6')
    expect(clientState.promptEditorMaxLinesInput).toBe('29')
    expect(clientState.showLineNumbers).toBe(true)
  })
})
