import type { Prompt } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { SystemSettings } from '@shared/SystemSettings'
import { describe, expect, it, afterEach } from 'vitest'
import { promptDraftCollection } from '@renderer/data/Collections/PromptDraftCollection'
import { promptFolderDraftCollection } from '@renderer/data/Collections/PromptFolderDraftCollection'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  systemSettingsDraftCollection
} from '@renderer/data/Collections/SystemSettingsDraftCollection'
import { updatePromptDraftSnapshotFromServer } from '@renderer/data/Mutations/PromptMutations'
import { updatePromptFolderDraftSnapshotFromServer } from '@renderer/data/Mutations/PromptFolderMutations'
import { updateSystemSettingsDraftSnapshotFromServer } from '@renderer/data/Mutations/SystemSettingsMutations'

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

const createPrompt = (): Prompt => ({
  id: 'prompt-1',
  title: 'Updated title',
  creationDate: '2026-01-01T00:00:00.000Z',
  lastModifiedDate: '2026-01-02T00:00:00.000Z',
  promptText: 'Updated text',
  promptFolderCount: 3
})

const createPromptFolder = (): PromptFolder => ({
  id: 'folder-1',
  folderName: 'folder',
  displayName: 'Folder',
  promptCount: 2,
  promptIds: ['prompt-1', 'prompt-2'],
  folderDescription: 'Updated folder description'
})

const createSystemSettings = (): SystemSettings => ({
  promptFontSize: 19,
  promptEditorMinLines: 6
})

describe('draft sync contract', () => {
  it('updates prompt drafts from server only when the draft already exists', () => {
    const prompt = createPrompt()

    expect(() => updatePromptDraftSnapshotFromServer(prompt)).toThrow(
      'Prompt draft not loaded'
    )
    expect(promptDraftCollection.get(prompt.id)).toBeUndefined()

    promptDraftCollection.insert({
      id: prompt.id,
      draftSnapshot: {
        ...prompt,
        title: 'Old title'
      },
      promptEditorMeasuredHeightsByKey: {
        '640:1': 200
      }
    })

    updatePromptDraftSnapshotFromServer(prompt)

    const draftRecord = promptDraftCollection.get(prompt.id)!
    expect(draftRecord.draftSnapshot).toEqual(prompt)
    expect(draftRecord.promptEditorMeasuredHeightsByKey).toEqual({ '640:1': 200 })
  })

  it('updates prompt-folder drafts from server only when the draft already exists', () => {
    const promptFolder = createPromptFolder()

    expect(() => updatePromptFolderDraftSnapshotFromServer(promptFolder)).toThrow(
      'Prompt folder draft not loaded'
    )
    expect(promptFolderDraftCollection.get(promptFolder.id)).toBeUndefined()

    promptFolderDraftCollection.insert({
      id: promptFolder.id,
      draftSnapshot: {
        folderDescription: 'Old folder description'
      },
      saveError: 'Previous save failed',
      descriptionMeasuredHeightsByKey: {
        '640:1': 120
      }
    })

    updatePromptFolderDraftSnapshotFromServer(promptFolder)

    const draftRecord = promptFolderDraftCollection.get(promptFolder.id)!
    expect(draftRecord.draftSnapshot.folderDescription).toBe(promptFolder.folderDescription)
    expect(draftRecord.saveError).toBeNull()
    expect(draftRecord.descriptionMeasuredHeightsByKey).toEqual({ '640:1': 120 })
  })

  it('updates the system-settings draft from server only when the draft already exists', () => {
    const settings = createSystemSettings()

    expect(() => updateSystemSettingsDraftSnapshotFromServer(settings)).toThrow(
      'System settings draft not loaded'
    )
    expect(systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)).toBeUndefined()

    systemSettingsDraftCollection.insert({
      id: SYSTEM_SETTINGS_DRAFT_ID,
      draftSnapshot: {
        promptFontSizeInput: '16',
        promptEditorMinLinesInput: '3'
      },
      saveError: 'Previous save failed'
    })

    updateSystemSettingsDraftSnapshotFromServer(settings)

    const draftRecord = systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)!
    expect(draftRecord.draftSnapshot).toEqual({
      promptFontSizeInput: '19',
      promptEditorMinLinesInput: '6'
    })
    expect(draftRecord.saveError).toBeNull()
  })
})
