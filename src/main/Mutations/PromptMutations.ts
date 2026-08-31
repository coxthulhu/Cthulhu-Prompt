import { promptEntryRef } from '@shared/OrderContainer'
import type { PromptPersisted } from '@shared/Prompt'
import {
  parseCreatePromptDomainCommand,
  parseUpdatePromptDomainCommand,
  planCreatePromptDomainMutation,
  planPromptUpdate,
  type CreatePromptDomainCommand,
  type UpdatePromptDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import {
  parseSetPromptStatusDomainCommand,
  planSetPromptStatusDomainMutation
} from '@shared/PromptDomainMutations'
import { data } from '../Data/Data'
import { buildPromptSnapshot } from '../Data/DataSnapshotHelpers'
import { parseDeletePromptRequest } from '../IpcFramework/IpcValidation'
import { handleMainDomainMutation } from './DomainMutation'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'

/** Registers prompt creation, update, deletion, movement, and status mutations. */
export const setupPromptMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<
    PromptPersisted,
    CreatePromptDomainCommand,
    UpdatePromptDomainCommand
  >({
    kind: 'prompt',
    label: 'Prompt',
    channels: {
      create: 'create-prompt',
      update: 'update-prompt',
      delete: 'delete-prompt',
      move: 'move-prompt'
    },
    createDomain: {
      parseCommand: parseCreatePromptDomainCommand,
      plan: planCreatePromptDomainMutation
    },
    updateDomain: {
      parseCommand: parseUpdatePromptDomainCommand,
      plan: planPromptUpdate
    },
    parsers: {
      delete: parseDeletePromptRequest
    },
    getContent: (promptId) => data.prompt.committedStore.getEntry(promptId),
    buildSnapshot: buildPromptSnapshot,
    createEntryRef: promptEntryRef,
    updateFilename: (tx, promptId, persistenceFields) =>
      tx.prompt.updatePersistenceFields({ id: promptId, persistenceFields }),
    deleteContent: (tx, promptId, expectedRevision) =>
      tx.prompt.delete({ id: promptId, expectedRevision })
  })

  handleMainDomainMutation({
    ipc: { channel: 'set-prompt-status' },
    mutation: {
      parseCommand: parseSetPromptStatusDomainCommand,
      plan: planSetPromptStatusDomainMutation
    }
  })
}
