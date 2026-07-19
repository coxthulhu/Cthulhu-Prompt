import type { PromptFolder } from '@shared/PromptFolder'
import { PromptStatus } from '@shared/Prompt'
import { promptCollection } from './PromptCollection'

export const getPromptFolderAllPromptIds = (promptFolder: PromptFolder): string[] => [
  ...promptFolder.entries.filter((entry) => entry.kind === 'prompt').map((entry) => entry.id),
  ...promptFolder.completedPromptIds
]

export const isPromptFolderEmpty = (promptFolder: PromptFolder): boolean =>
  promptFolder.entries.length === 0 &&
  promptFolder.completedPromptIds.length === 0 &&
  Object.values(promptFolder.settings).every((value) => (value ?? '').trim().length === 0)

export const getPromptFolderPromptIds = (promptFolder: PromptFolder): string[] => {
  return getPromptFolderAllPromptIds(promptFolder).filter(
    (promptId) => promptCollection.get(promptId)?.status !== PromptStatus.Completed
  )
}

export const getPromptFolderCompletedPromptIds = (promptFolder: PromptFolder): string[] => [
  ...promptFolder.completedPromptIds
]

export const getPromptFolderActiveEntryIds = (promptFolder: PromptFolder): string[] =>
  promptFolder.entries.flatMap((entry) => {
    if (entry.kind === 'folder') return [entry.id]
    return promptCollection.get(entry.id)?.status === PromptStatus.Completed ? [] : [entry.id]
  })
