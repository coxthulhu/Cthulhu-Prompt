import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { Prompt } from '@shared/Prompt'

const roundDevicePixelRatio = (value: number): number => {
  return Math.round(value * 100) / 100
}

export const createPromptDraftMeasuredHeightKey = (
  widthPx: number,
  devicePixelRatio: number
): string => {
  return `${widthPx}:${roundDevicePixelRatio(devicePixelRatio)}`
}

export type PromptDraftRecord = {
  id: Prompt['id']
  title: Prompt['title']
  creationDate: Prompt['creationDate']
  lastModifiedDate: Prompt['lastModifiedDate']
  promptText: Prompt['promptText']
  promptFolderCount: Prompt['promptFolderCount']
  // Mirrors measuredHeightCache for prompt editor rows.
  promptEditorMeasuredHeightsByKey: Record<string, number>
}

// Local-only UI draft state for prompt title/text editing.
export const promptDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptDraftRecord>({
    id: 'prompt-drafts',
    getKey: (draft) => draft.id
  })
)
