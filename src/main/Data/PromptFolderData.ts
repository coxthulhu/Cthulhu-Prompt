import type { PromptFolder } from '@shared/PromptFolder'
import {
  promptFolderPersistence,
  type PromptFolderPersistenceFields
} from '../Persistence/PromptFolderPersistence'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt folder update events.
}

export const promptFolderData = createRevisionData<PromptFolder, PromptFolderPersistenceFields>({
  persistence: promptFolderPersistence,
  emitCommittedRevisionChanged
})
