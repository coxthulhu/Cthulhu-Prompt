import {
  parseDeleteMarkdownContentDomainCommand,
  parseMoveMarkdownContentDomainCommand,
  planPromptDelete,
  planPromptMove,
  planPromptTemplateDelete,
  planPromptTemplateMove,
  selectMarkdownContentDeletionExpectedTargets,
  type CreatePromptDomainCommand,
  type CreatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import type { DomainCommandParser, DomainPlanner } from '@shared/DomainChanges'
import type { PromptFolderContentKind } from '@shared/PromptFolder'
import { handleMainDomainMutation } from './DomainMutation'

/** Shared main-process registration for prompt and prompt-template mutation channels. */
export type MarkdownContentMutationConfig<
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand,
  TUpdateCommand
> = {
  kind: PromptFolderContentKind
  channels: {
    create: string
    update: string
    delete: string
    move: string
  }
  createDomain: {
    parseCommand: DomainCommandParser<TCreateCommand>
    plan: DomainPlanner<TCreateCommand>
  }
  updateDomain: {
    parseCommand: DomainCommandParser<TUpdateCommand>
    plan: DomainPlanner<TUpdateCommand>
  }
}

/** Registers create, update, delete, and move handlers for one markdown-content kind. */
export const setupMarkdownContentMutationHandlers = <
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand,
  TUpdateCommand
>(config: MarkdownContentMutationConfig<TCreateCommand, TUpdateCommand>): void => {
  /** Move planner selected by the channel's configured content kind. */
  const movePlanner = config.kind === 'prompt' ? planPromptMove : planPromptTemplateMove
  /** Delete planner selected by the channel's configured content kind. */
  const deletePlanner = config.kind === 'prompt' ? planPromptDelete : planPromptTemplateDelete
  handleMainDomainMutation({
    ipc: { channel: config.channels.create },
    mutation: config.createDomain
  })
  handleMainDomainMutation({
    ipc: { channel: config.channels.update },
    mutation: config.updateDomain
  })
  handleMainDomainMutation({
    ipc: { channel: config.channels.delete },
    mutation: {
      parseCommand: parseDeleteMarkdownContentDomainCommand,
      plan: deletePlanner,
      selectExpectedTargets: selectMarkdownContentDeletionExpectedTargets
    }
  })
  handleMainDomainMutation({
    ipc: { channel: config.channels.move },
    mutation: {
      parseCommand: parseMoveMarkdownContentDomainCommand,
      plan: movePlanner
    }
  })
}
