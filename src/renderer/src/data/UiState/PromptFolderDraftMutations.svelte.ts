import type { PromptFolder } from '@shared/PromptFolder'
import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  type PromptFolderDraftRecord,
  promptFolderDraftCollection
} from '../Collections/PromptFolderDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedPromptFolderAutosaveUpdate } from '../Mutations/PromptFolderMutations'
import {
  clearPromptFolderDescriptionMeasuredHeight,
  clearPromptFolderDescriptionMeasuredHeights,
  clearPromptFolderScrollTop,
  clearPromptFolderScrollTops,
  recordPromptFolderDescriptionMeasuredHeight
} from './PromptFolderDraftUiCache.svelte.ts'

export type PromptFolderDraftState = PromptFolderDraftRecord

const toPromptFolderDescription = (promptFolder: PromptFolder): string => {
  return promptFolder.folderDescription
}

const haveSamePromptFolderDescription = (left: string, right: string): boolean => {
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
  const draftUpdatesById: Record<string, string> = {}
  const draftUpdateIds: string[] = []

  for (const promptFolder of promptFolders) {
    const nextDescription = toPromptFolderDescription(promptFolder)
    const existingRecord = promptFolderDraftCollection.get(promptFolder.id)

    if (!existingRecord) {
      clearPromptFolderDescriptionMeasuredHeight(promptFolder.id)
      clearPromptFolderScrollTop(promptFolder.id)
      draftInserts.push({
        id: promptFolder.id,
        folderDescription: nextDescription,
        hasLoadedInitialData: false
      })
      continue
    }

    if (haveSamePromptFolderDescription(existingRecord.folderDescription, nextDescription)) {
      continue
    }

    clearPromptFolderDescriptionMeasuredHeight(promptFolder.id)

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
): PromptFolderDraftState | null => {
  return promptFolderDraftCollection.get(promptFolderId) ?? null
}

export const setPromptFolderDraftDescription = (
  promptFolderId: string,
  folderDescription: string,
  measurement: TextMeasurement
): void => {
  const draftRecord = getPromptFolderDraftState(promptFolderId)
  if (!draftRecord) {
    // Monaco can emit an initial onChange before the folder draft is hydrated.
    recordPromptFolderDescriptionMeasuredHeight(promptFolderId, measurement, false)
    return
  }
  const textChanged = draftRecord.folderDescription !== folderDescription
  recordPromptFolderDescriptionMeasuredHeight(promptFolderId, measurement, textChanged)

  if (!textChanged) {
    return
  }

  mutatePromptFolderDraftOptimistically(promptFolderId, {
    mutatePromptFolderDraft: (draft) => {
      draft.folderDescription = folderDescription
    },
    mutatePromptFolder: (draft) => {
      draft.folderDescription = folderDescription
    }
  })
}

export const deletePromptFolderDrafts = (promptFolderIds: string[]): void => {
  if (promptFolderIds.length === 0) {
    return
  }

  clearPromptFolderDescriptionMeasuredHeights(promptFolderIds)
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
