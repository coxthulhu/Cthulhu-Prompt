import type { Prompt } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { SystemSettings } from '@shared/SystemSettings'
import { afterEach, describe, expect, it } from 'vitest'
import { promptDraftCollection } from '@renderer/data/Collections/PromptDraftCollection'
import { promptFolderDraftCollection } from '@renderer/data/Collections/PromptFolderDraftCollection'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  systemSettingsDraftCollection
} from '@renderer/data/Collections/SystemSettingsDraftCollection'
import { upsertPromptDraft } from '@renderer/data/UiState/PromptDraftMutations.svelte.ts'
import { upsertPromptFolderDraft } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
import { upsertSystemSettingsDraft } from '@renderer/data/UiState/SystemSettingsDraftMutations.svelte.ts'

const clearPromptDraftCollection = (): void => {
  const draftIds = Array.from(promptDraftCollection.keys(), (draftId) => String(draftId))
  if (draftIds.length > 0) {
    promptDraftCollection.delete(draftIds)
  }
}

const clearPromptFolderDraftCollection = (): void => {
  const draftIds = Array.from(
    promptFolderDraftCollection.keys(),
    (draftId) => String(draftId)
  )
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

const createPrompt = (overrides: Partial<Prompt> = {}): Prompt => ({
  id: 'prompt-1',
  title: 'Original title',
  creationDate: '2026-01-01T00:00:00.000Z',
  lastModifiedDate: '2026-01-02T00:00:00.000Z',
  promptText: 'Original text',
  promptFolderCount: 3,
  ...overrides
})

const createPromptFolder = (
  overrides: Partial<PromptFolder> = {}
): PromptFolder => ({
  id: 'folder-1',
  folderName: 'folder',
  displayName: 'Folder',
  promptCount: 2,
  promptIds: ['prompt-1', 'prompt-2'],
  folderDescription: 'Original folder description',
  ...overrides
})

const createSystemSettings = (
  overrides: Partial<SystemSettings> = {}
): SystemSettings => ({
  promptFontSize: 16,
  promptEditorMinLines: 3,
  ...overrides
})

describe('draft sync contract', () => {
  it('upserts prompt drafts and preserves measured heights', () => {
    const prompt = createPrompt()
    const updatedPrompt = createPrompt({
      title: 'Updated title',
      promptText: 'Updated text',
      lastModifiedDate: '2026-01-03T00:00:00.000Z'
    })

    upsertPromptDraft(prompt)

    promptDraftCollection.update(prompt.id, (draftRecord) => {
      draftRecord.promptEditorMeasuredHeightsByKey = { '640:1': 200 }
    })

    upsertPromptDraft(updatedPrompt)

    const draftRecord = promptDraftCollection.get(prompt.id)!
    expect(draftRecord).toMatchObject(updatedPrompt)
    expect(draftRecord.promptEditorMeasuredHeightsByKey).toEqual({ '640:1': 200 })
  })

  it('upserts prompt-folder drafts and preserves measured heights', () => {
    const promptFolder = createPromptFolder()
    const updatedPromptFolder = createPromptFolder({
      folderDescription: 'Updated folder description'
    })

    upsertPromptFolderDraft(promptFolder)

    promptFolderDraftCollection.update(promptFolder.id, (draftRecord) => {
      draftRecord.descriptionMeasuredHeightsByKey = { '640:1': 120 }
    })

    upsertPromptFolderDraft(updatedPromptFolder)

    const draftRecord = promptFolderDraftCollection.get(promptFolder.id)!
    expect(draftRecord.folderDescription).toBe('Updated folder description')
    expect(draftRecord.descriptionMeasuredHeightsByKey).toEqual({ '640:1': 120 })
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
