import type { PromptFull, PromptSummaryData } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { SystemSettings } from '@shared/SystemSettings'
import { afterEach, describe, expect, it } from 'vitest'
import { promptDraftCollection } from '@renderer/data/Collections/PromptDraftCollection'
import { promptFolderDraftCollection } from '@renderer/data/Collections/PromptFolderDraftCollection'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  systemSettingsDraftCollection
} from '@renderer/data/Collections/SystemSettingsDraftCollection'
import {
  upsertPromptDraft,
  upsertPromptSummaryDrafts
} from '@renderer/data/UiState/PromptDraftMutations.svelte.ts'
import {
  setPromptFolderDraftDescription,
  upsertPromptFolderDraft
} from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
import { upsertSystemSettingsDraft } from '@renderer/data/UiState/SystemSettingsDraftMutations.svelte.ts'

const clearPromptDraftCollection = (): void => {
  const draftIds = Array.from(promptDraftCollection.keys(), (draftId) => String(draftId))
  if (draftIds.length > 0) {
    promptDraftCollection.delete(draftIds)
  }
}

const clearPromptFolderDraftCollection = (): void => {
  const draftIds = Array.from(promptFolderDraftCollection.keys(), (draftId) => String(draftId))
  if (draftIds.length > 0) {
    promptFolderDraftCollection.delete(draftIds)
  }
}

const clearSystemSettingsDraftCollection = (): void => {
  if (systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)) {
    systemSettingsDraftCollection.delete(SYSTEM_SETTINGS_DRAFT_ID)
  }
}

afterEach(() => {
  clearPromptDraftCollection()
  clearPromptFolderDraftCollection()
  clearSystemSettingsDraftCollection()
})

const createPrompt = (overrides: Partial<PromptFull> = {}): PromptFull => ({
  id: 'prompt-1',
  title: 'Original title',
  creationDate: '2026-01-01T00:00:00.000Z',
  lastModifiedDate: '2026-01-02T00:00:00.000Z',
  promptText: 'Original text',
  promptFolderCount: 3,
  loadingState: 'full',
  ...overrides
})

const createPromptSummary = (
  overrides: Partial<PromptSummaryData> = {}
): PromptSummaryData => ({
  id: 'prompt-1',
  title: 'Original title',
  ...overrides
})

const createPromptFolder = (overrides: Partial<PromptFolder> = {}): PromptFolder => ({
  id: 'folder-1',
  folderName: 'folder',
  displayName: 'Folder',
  promptCount: 2,
  promptIds: ['prompt-1', 'prompt-2'],
  folderDescription: 'Original folder description',
  ...overrides
})

const createSystemSettings = (overrides: Partial<SystemSettings> = {}): SystemSettings => ({
  promptFontSize: 16,
  promptEditorMinLines: 3,
  ...overrides
})

describe('draft sync contract', () => {
  it('upserts prompt drafts', () => {
    const prompt = createPrompt()
    const updatedPrompt = createPrompt({
      title: 'Updated title',
      promptText: 'Updated text',
      lastModifiedDate: '2026-01-03T00:00:00.000Z'
    })

    upsertPromptDraft(prompt)
    upsertPromptDraft(updatedPrompt)

    const draftRecord = promptDraftCollection.get(prompt.id)!
    const { loadingState: _loadingState, ...expectedDraftRecord } = updatedPrompt
    expect(draftRecord).toMatchObject(expectedDraftRecord)
  })

  it('upserts prompt summary drafts without clobbering full draft fields', () => {
    const fullPrompt = createPrompt()
    const summaryPrompt = createPromptSummary({ title: 'Updated summary title' })

    upsertPromptDraft(fullPrompt)
    upsertPromptSummaryDrafts([summaryPrompt])

    const draftRecord = promptDraftCollection.get(fullPrompt.id)!
    expect(draftRecord.title).toBe(summaryPrompt.title)
    expect(draftRecord.creationDate).toBe(fullPrompt.creationDate)
    expect(draftRecord.lastModifiedDate).toBe(fullPrompt.lastModifiedDate)
    expect(draftRecord.promptText).toBe(fullPrompt.promptText)
    expect(draftRecord.promptFolderCount).toBe(fullPrompt.promptFolderCount)
  })

  it('seeds prompt summary drafts when full prompt data is not loaded yet', () => {
    const summaryPrompt = createPromptSummary({ id: 'prompt-summary-1', title: 'Summary title' })

    upsertPromptSummaryDrafts([summaryPrompt])

    const draftRecord = promptDraftCollection.get(summaryPrompt.id)!
    expect(draftRecord).toEqual({
      id: summaryPrompt.id,
      title: summaryPrompt.title,
      creationDate: '',
      lastModifiedDate: '',
      promptText: '',
      promptFolderCount: 0
    })
  })

  it('upserts prompt-folder drafts', () => {
    const promptFolder = createPromptFolder()
    const updatedPromptFolder = createPromptFolder({
      folderDescription: 'Updated folder description'
    })

    upsertPromptFolderDraft(promptFolder)
    upsertPromptFolderDraft(updatedPromptFolder)

    const draftRecord = promptFolderDraftCollection.get(promptFolder.id)!
    expect(draftRecord.folderDescription).toBe('Updated folder description')
    expect(draftRecord.hasLoadedInitialData).toBe(false)
  })

  it('ignores prompt-folder description updates when the draft is missing', () => {
    expect(() =>
      setPromptFolderDraftDescription('missing-folder-id', 'Updated folder description', {
        measuredHeightPx: 144,
        widthPx: 700,
        devicePixelRatio: 1
      })
    ).not.toThrow()
    expect(promptFolderDraftCollection.get('missing-folder-id')).toBeUndefined()
  })

  it('upserts the system-settings draft', () => {
    upsertSystemSettingsDraft(createSystemSettings())

    systemSettingsDraftCollection.update(SYSTEM_SETTINGS_DRAFT_ID, (draftRecord) => {
      draftRecord.promptFontSizeInput = '18'
      draftRecord.promptEditorMinLinesInput = '5'
    })

    upsertSystemSettingsDraft(
      createSystemSettings({
        promptFontSize: 19,
        promptEditorMinLines: 6
      })
    )

    const draftRecord = systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)!
    expect(draftRecord.promptFontSizeInput).toBe('19')
    expect(draftRecord.promptEditorMinLinesInput).toBe('6')
  })
})
