import type { PromptFolder } from '@shared/PromptFolder'
import { PromptStatus } from '@shared/Prompt'
import { promptCollection } from './PromptCollection'

export const getPromptFolderAllPromptIds = (promptFolder: PromptFolder): string[] =>
  promptFolder.entries.filter((entry) => entry.kind === 'prompt').map((entry) => entry.id)

export const getPromptFolderPromptIds = (promptFolder: PromptFolder): string[] => {
  return getPromptFolderAllPromptIds(promptFolder).filter(
    (promptId) => promptCollection.get(promptId)?.status !== PromptStatus.Completed
  )
}

export const getPromptFolderCompletedPromptIds = (promptFolder: PromptFolder): string[] =>
  getPromptFolderAllPromptIds(promptFolder).filter(
    (promptId) => promptCollection.get(promptId)?.status === PromptStatus.Completed
  )

export const getPromptFolderActiveEntryIds = (promptFolder: PromptFolder): string[] =>
  promptFolder.entries.flatMap((entry) => {
    if (entry.kind === 'folder') return [entry.id]
    return promptCollection.get(entry.id)?.status === PromptStatus.Completed ? [] : [entry.id]
  })
