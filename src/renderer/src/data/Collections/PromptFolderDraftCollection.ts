import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

const roundDevicePixelRatio = (value: number): number => {
  return Math.round(value * 100) / 100
}

export const createPromptFolderDraftMeasuredHeightKey = (
  widthPx: number,
  devicePixelRatio: number
): string => {
  return `${widthPx}:${roundDevicePixelRatio(devicePixelRatio)}`
}

export type PromptFolderDraftRecord = {
  id: string
  folderDescription: string
  // Mirrors measuredHeightCache for prompt folder description.
  descriptionMeasuredHeightsByKey: Record<string, number>
}

// Local-only UI draft state for prompt folder description editing.
export const promptFolderDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptFolderDraftRecord>({
    id: 'prompt-folder-drafts',
    getKey: (draft) => draft.id
  })
)
