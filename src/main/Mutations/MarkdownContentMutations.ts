import {
  parseDeleteMarkdownContentDomainCommand,
  planPromptDelete,
  planPromptTemplateDelete,
  type CreatePromptDomainCommand,
  type CreatePromptTemplateDomainCommand
} from '@shared/domain/markdown-content/MarkdownContentDomainMutations'
import type { DomainCommandParser, DomainPlanner } from '@shared/domain/DomainChanges'
import type { PromptFolderContentKind } from '@shared/domain/prompt-folder/PromptFolder'
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

/** Registers create, update, and delete handlers for one markdown-content kind. */
export const setupMarkdownContentMutationHandlers = <
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand,
  TUpdateCommand
>(config: MarkdownContentMutationConfig<TCreateCommand, TUpdateCommand>): void => {
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
      plan: deletePlanner
    }
  })
}
