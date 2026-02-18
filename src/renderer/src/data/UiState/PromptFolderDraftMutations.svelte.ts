import type { PromptFolder } from '@shared/PromptFolder'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  createPromptFolderDraftMeasuredHeightKey,
  type PromptFolderDraftRecord,
  promptFolderDraftCollection
} from '../Collections/PromptFolderDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedPromptFolderAutosaveUpdate } from '../Mutations/PromptFolderMutations'

export type PromptFolderDraftState = PromptFolderDraftRecord

const toPromptFolderDescription = (promptFolder: PromptFolder): string => {
  return promptFolder.folderDescription
}

const haveSamePromptFolderDescription = (
  left: string,
  right: string
): boolean => {
  return left === right
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

  mutatePacedPromptFolderAutosaveUpdate({
    promptFolderId,
    debounceMs: AUTOSAVE_MS,
    draftOnlyChange: mutatePromptFolder == null,
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

const applyDescriptionMeasurementUpdate = (
  draftRecord: PromptFolderDraftRecord,
  measurement: TextMeasurement,
  textChanged: boolean
): void => {
  const key = createPromptFolderDraftMeasuredHeightKey(
    measurement.widthPx,
    measurement.devicePixelRatio
  )

  if (textChanged) {
    if (measurement.measuredHeightPx == null) {
      draftRecord.descriptionMeasuredHeightsByKey = {}
      return
    }

    draftRecord.descriptionMeasuredHeightsByKey = {
      [key]: measurement.measuredHeightPx
    }
    return
  }

  if (measurement.measuredHeightPx == null) {
    return
  }

  draftRecord.descriptionMeasuredHeightsByKey[key] = measurement.measuredHeightPx
}

export const upsertPromptFolderDraft = (promptFolder: PromptFolder): void => {
  upsertPromptFolderDrafts([promptFolder])
}

export const upsertPromptFolderDrafts = (
  promptFolders: PromptFolder[]
): void => {
  if (promptFolders.length === 0) {
    return
  }

  const draftInserts: PromptFolderDraftRecord[] = []
  const draftUpdatesById: Record<string, string> = {}
  const draftUpdateIds: string[] = []

  for (const promptFolder of promptFolders) {
    const nextDescription = toPromptFolderDescription(promptFolder)
    const existingRecord = promptFolderDraftCollection.get(promptFolder.id)

    if (!existingRecord) {
      draftInserts.push({
        id: promptFolder.id,
        folderDescription: nextDescription,
        hasLoadedInitialData: false,
        descriptionMeasuredHeightsByKey: {}
      })
      continue
    }

    if (haveSamePromptFolderDescription(existingRecord.folderDescription, nextDescription)) {
      continue
    }

    if (!draftUpdatesById[promptFolder.id]) {
      draftUpdateIds.push(promptFolder.id)
    }
    draftUpdatesById[promptFolder.id] = nextDescription
  }

  if (draftInserts.length > 0) {
    promptFolderDraftCollection.insert(draftInserts)
  }

  if (draftUpdateIds.length > 0) {
    promptFolderDraftCollection.update(draftUpdateIds, (draftRecords) => {
      for (const draftRecord of draftRecords) {
        const nextDescription = draftUpdatesById[draftRecord.id]
        if (nextDescription == null) {
          continue
        }

        draftRecord.folderDescription = nextDescription
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
): PromptFolderDraftState => {
  return promptFolderDraftCollection.get(promptFolderId)!
}

export const setPromptFolderDraftDescription = (
  promptFolderId: string,
  folderDescription: string,
  measurement: TextMeasurement
): void => {
  const draftRecord = getPromptFolderDraftState(promptFolderId)
  const textChanged = draftRecord.folderDescription !== folderDescription

  if (!textChanged) {
    mutatePromptFolderDraftOptimistically(promptFolderId, {
      mutatePromptFolderDraft: (draft) => {
        applyDescriptionMeasurementUpdate(draft, measurement, false)
      }
    })

    return
  }

  mutatePromptFolderDraftOptimistically(promptFolderId, {
    mutatePromptFolderDraft: (draft) => {
      draft.folderDescription = folderDescription
      applyDescriptionMeasurementUpdate(draft, measurement, true)
    },
    mutatePromptFolder: (draft) => {
      draft.folderDescription = folderDescription
    }
  })
}

export const deletePromptFolderDrafts = (
  promptFolderIds: string[]
): void => {
  if (promptFolderIds.length === 0) {
    return
  }

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
  const draftIds = Array.from(
    promptFolderDraftCollection.keys(),
    (draftId) => String(draftId)
  )
  deletePromptFolderDrafts(draftIds)
}
