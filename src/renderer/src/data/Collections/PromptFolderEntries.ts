import type { PromptFolder } from '@shared/PromptFolder'
import { promptCollection } from './PromptCollection'

export const getPromptFolderPromptIds = (promptFolder: PromptFolder): string[] => {
  return promptFolder.entryIds.filter((entryId) => promptCollection.get(entryId))
}
