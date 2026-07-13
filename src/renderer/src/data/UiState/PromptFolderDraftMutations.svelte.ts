import {
  copyPromptFolderSettings,
  haveSamePromptFolderSettings,
  type PromptFolder,
  type PromptFolderSettingsField
} from '@shared/PromptFolder'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  type PromptFolderDraftRecord,
  promptFolderDraftCollection
} from '../Collections/PromptFolderDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedPromptFolderSettingsAutosaveUpdate } from '../Mutations/PromptFolderMutations'
import {
  clearPromptFolderSettingsRowMeasuredHeight,
  clearPromptFolderSettingsRowMeasuredHeights,
  clearPromptFolderScrollTop,
  clearPromptFolderScrollTops,
  recordPromptFolderSettingsRowMeasuredHeight
} from './PromptFolderDraftUiCache.svelte.ts'

export type PromptFolderDraftState = PromptFolderDraftRecord
export type PromptFolderSettingsDraftField = PromptFolderSettingsField

const createPromptFolderDraftRecord = (promptFolder: PromptFolder): PromptFolderDraftRecord => {
  return {
    id: promptFolder.id,
    settings: copyPromptFolderSettings(promptFolder.settings),
    hasLoadedInitialData: false
  }
}

type PromptFolderDraftOptimisticMutationOptions = {
  mutatePromptFolderDraft: (draft: PromptFolderDraftRecord) => void
  mutatePromptFolder?: (draft: PromptFolder) => void
}

const mutatePromptFolderDraftOptimistically = (
  promptFolderId: string,
  options: PromptFolderDraftOptimisticMutationOptions
): void => {
  const { mutatePromptFolderDraft, mutatePromptFolder } = options

  mutatePacedPromptFolderSettingsAutosaveUpdate({
    promptFolderId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.promptFolderDraft.update(promptFolderId, (draftRecord) => {
        mutatePromptFolderDraft(draftRecord)
      })

      if (mutatePromptFolder) {
        collections.promptFolder.update(promptFolderId, mutatePromptFolder)
      }
    }
  })
}

export const upsertPromptFolderDraft = (promptFolder: PromptFolder): void => {
  upsertPromptFolderDrafts([promptFolder])
}

export const upsertPromptFolderDrafts = (promptFolders: PromptFolder[]): void => {
  if (promptFolders.length === 0) {
    return
  }

  const draftInserts: PromptFolderDraftRecord[] = []
  const draftUpdatesById: Record<string, PromptFolder> = {}
  const draftUpdateIds: string[] = []

  for (const promptFolder of promptFolders) {
    const existingRecord = promptFolderDraftCollection.get(promptFolder.id)

    if (!existingRecord) {
      clearPromptFolderSettingsRowMeasuredHeight(promptFolder.id)
      clearPromptFolderScrollTop(promptFolder.id)
      draftInserts.push(createPromptFolderDraftRecord(promptFolder))
      continue
    }

    if (haveSamePromptFolderSettings(existingRecord.settings, promptFolder.settings)) {
      continue
    }

    clearPromptFolderSettingsRowMeasuredHeight(promptFolder.id)

    if (!draftUpdatesById[promptFolder.id]) {
      draftUpdateIds.push(promptFolder.id)
    }
    draftUpdatesById[promptFolder.id] = promptFolder
  }

  if (draftInserts.length > 0) {
    promptFolderDraftCollection.insert(draftInserts)
  }

  if (draftUpdateIds.length > 0) {
    promptFolderDraftCollection.update(draftUpdateIds, (draftRecords) => {
      for (const draftRecord of draftRecords) {
        const nextPromptFolder = draftUpdatesById[draftRecord.id]
        if (nextPromptFolder == null) {
          continue
        }

        draftRecord.settings = copyPromptFolderSettings(nextPromptFolder.settings)
      }
    })
  }
}

export const setPromptFolderDraftHasLoadedInitialData = (
  promptFolderId: string,
  hasLoadedInitialData: boolean
): void => {
  const draftRecord = promptFolderDraftCollection.get(promptFolderId)
  if (!draftRecord || draftRecord.hasLoadedInitialData === hasLoadedInitialData) {
    return
  }

  promptFolderDraftCollection.update(promptFolderId, (draft) => {
    draft.hasLoadedInitialData = hasLoadedInitialData
  })
}

export const getPromptFolderDraftState = (
  promptFolderId: string
): PromptFolderDraftState | null => {
  return promptFolderDraftCollection.get(promptFolderId) ?? null
}

export const setPromptFolderDraftSettingsField = (
  promptFolderId: string,
  field: PromptFolderSettingsDraftField,
  value: string,
  measurement: TextMeasurement
): void => {
  const draftRecord = getPromptFolderDraftState(promptFolderId)
  if (!draftRecord) {
    // Monaco can emit an initial onChange before the folder draft is hydrated.
    recordPromptFolderSettingsRowMeasuredHeight(promptFolderId, field, measurement, false)
    return
  }
  const textChanged = draftRecord.settings[field] !== value
  recordPromptFolderSettingsRowMeasuredHeight(promptFolderId, field, measurement, textChanged)

  if (!textChanged) {
    return
  }

  mutatePromptFolderDraftOptimistically(promptFolderId, {
    mutatePromptFolderDraft: (draft) => {
      draft.settings[field] = value
    },
    mutatePromptFolder: (draft) => {
      draft.settings[field] = value
    }
  })
}

export const deletePromptFolderDrafts = (promptFolderIds: string[]): void => {
  if (promptFolderIds.length === 0) {
    return
  }

  clearPromptFolderSettingsRowMeasuredHeights(promptFolderIds)
  clearPromptFolderScrollTops(promptFolderIds)
  promptFolderDraftCollection.delete(promptFolderIds)
}

export const removePromptFolderDraft = (promptFolderId: string): void => {
  deletePromptFolderDrafts([promptFolderId])
}

export const flushPromptFolderDraftAutosaves = async (): Promise<void> => {
  const tasks = promptFolderDraftCollection.toArray.map(async (draftRecord) => {
    await submitPacedUpdateTransactionAndWait(promptFolderCollection.id, draftRecord.id)
  })
  await Promise.allSettled(tasks)
}

export const clearPromptFolderDraftStore = (): void => {
  const draftIds = Array.from(promptFolderDraftCollection.keys(), (draftId) => String(draftId))
  deletePromptFolderDrafts(draftIds)
}
