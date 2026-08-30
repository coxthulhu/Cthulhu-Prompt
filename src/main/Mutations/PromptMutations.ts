import { promptEntryRef } from '@shared/OrderContainer'
import { PromptStatus, type PromptPersisted } from '@shared/Prompt'
import {
  parseCreatePromptDomainCommand,
  planCreatePromptDomainMutation,
  type CreatePromptDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import {
  parseSetPromptStatusDomainCommand,
  planSetPromptStatusDomainMutation
} from '@shared/PromptDomainMutations'
import { data } from '../Data/Data'
import { buildPromptSnapshot } from '../Data/DataSnapshotHelpers'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import {
  parseDeletePromptRequest,
  parseUpdatePromptRevisionRequest
} from '../IpcFramework/IpcValidation'
import { handleMainDomainMutation } from './DomainMutation'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'

/** Registers prompt creation, update, deletion, movement, and status mutations. */
export const setupPromptMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<PromptPersisted, CreatePromptDomainCommand>({
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
    parsers: {
      update: parseUpdatePromptRevisionRequest,
      delete: parseDeletePromptRequest
    },
    getContent: (promptId) => data.prompt.committedStore.getEntry(promptId),
    buildSnapshot: buildPromptSnapshot,
    createEntryRef: promptEntryRef,
    updatePersisted: (requested, _current, titleFields) => ({
      id: requested.id,
      ...titleFields,
      createdAt: requested.createdAt,
      modifiedAt: requested.modifiedAt,
      promptText: requested.promptText,
      ...(requested.category !== undefined ? { category: requested.category } : {}),
      ...(requested.templates !== undefined ? { templates: requested.templates } : {}),
      status: requested.status,
      ...(requested.status === PromptStatus.Completed && requested.completedAt
        ? { completedAt: requested.completedAt }
        : {})
    }),
    canMove: (prompt) => prompt.status !== PromptStatus.Completed,
    updateContent: (tx, operation) =>
      tx.prompt.update({
        id: operation.id,
        expectedRevision: operation.expectedRevision,
        recipe: (draft) => {
          Object.assign(draft, operation.data)
          if (!operation.data.completedAt) delete draft.completedAt
          if (operation.data.templates === undefined) delete draft.templates
          if (operation.data.category === undefined) delete draft.category
        },
        persistenceFields: operation.persistenceFields
      }),
    updateFilename: (tx, promptId, persistenceFields) =>
      tx.prompt.updatePersistenceFields({ id: promptId, persistenceFields }),
    deleteContent: (tx, promptId, expectedRevision) =>
      tx.prompt.delete({ id: promptId, expectedRevision }),
    onDeleted: (workspaceId, promptId) => {
      // Side effect: remove persisted Monaco view state for deleted prompts.
      MarkdownContentUiStateDataAccess.deleteMarkdownContentUiState(workspaceId, promptId)
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'set-prompt-status' },
    mutation: {
      parseCommand: parseSetPromptStatusDomainCommand,
      plan: planSetPromptStatusDomainMutation
    }
  })
}
