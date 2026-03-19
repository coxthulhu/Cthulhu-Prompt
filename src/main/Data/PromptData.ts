import type { PromptPersisted } from '@shared/Prompt'
import {
  promptPersistence,
  type PromptPersistenceFields
} from '../Persistence/PromptPersistence'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt update events.
}

export const promptData = createRevisionData<PromptPersisted, PromptPersistenceFields>({
  persistence: promptPersistence,
  emitCommittedRevisionChanged
})
