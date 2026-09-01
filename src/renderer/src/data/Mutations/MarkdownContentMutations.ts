import type { Transaction } from '@tanstack/svelte-db'
import { produce, type Draft } from 'immer'
import {
  planPromptDelete,
  planPromptMove,
  planPromptTemplateDelete,
  planPromptTemplateMove,
  selectMarkdownContentDeletionExpectedTargets,
  type CreatePromptDomainCommand,
  type CreatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import type { DomainPlanner } from '@shared/DomainChanges'
import { type MarkdownContentPersisted } from '@shared/MarkdownContent'
import { type PromptFolderContentKind } from '@shared/PromptFolder'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import {
  mutatePacedRendererDomainMutation,
  runImmediateRendererDomainMutation
} from '../IpcFramework/RendererDomainMutation'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'

/** Revision mutation options used to derive local helper types. */
type MutationOptions<TPayload> = Parameters<typeof runRevisionMutation<TPayload>>[0]
/** Optimistic collection helpers supplied by the revision framework. */
type OptimisticCollections = Parameters<MutationOptions<unknown>['mutateOptimistically']>[0][
  'collections'
]
/** Canonical editable fields shared by prompts and prompt templates. */
type ContentRecord = { id: string; title: string; fallbackTitle: string; category?: string }

/** Entity-specific adapters used by shared renderer content mutations. */
export type MarkdownContentRendererMutationConfig<
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted,
  TCreateCommand,
  TUpdateCommand
> = {
  kind: PromptFolderContentKind
  label: string
  channels: { create: string; update: string; delete: string; move: string }
  getContent: (contentId: string) => ContentRecord | undefined
  getFullPersisted: (contentId: string) => TPersisted | null
  createDomain: {
    plan: DomainPlanner<TCreateCommand>
    createCommand: (
      promptFolderId: string,
      content: TFull,
      previousEntryId: string | null,
      categoryId: string | null
    ) => TCreateCommand
  }
  updateDomain: {
    plan: DomainPlanner<TUpdateCommand>
    createCommand: (content: TPersisted) => TUpdateCommand
  }
  insertClientStateOptimistically: (
    collections: OptimisticCollections,
    contentId: string
  ) => void
  markClientStateEdited: (
    collections: OptimisticCollections,
    contentId: string
  ) => void
  acceptClientStateMutations: (transaction: Transaction<any>) => void
}

/** Creates category-aware prompt or template renderer mutations. */
export const createMarkdownContentRendererMutations = <
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted,
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand,
  TUpdateCommand
>(
  config: MarkdownContentRendererMutationConfig<
    TPersisted,
    TFull,
    TCreateCommand,
    TUpdateCommand
  >
) => {
  /** Move planner selected by the renderer channel's configured markdown-content kind. */
  const movePlanner = config.kind === 'prompt' ? planPromptMove : planPromptTemplateMove
  /** Delete planner selected by the renderer channel's configured markdown-content kind. */
  const deletePlanner = config.kind === 'prompt' ? planPromptDelete : planPromptTemplateDelete
  /** Domain entity type selected by the configured content kind. */
  const entityType = config.kind === 'prompt' ? 'prompt' : 'promptTemplate'

  /** Creates content at one exact position in Uncategorized or a category. */
  const create = async (
    promptFolderId: string,
    content: TFull,
    previousEntryId: string | null,
    categoryId: string | null = null
  ): Promise<void> => {
    /** Root folder that owns the new content and category order. */
    const promptFolder = promptFolderCollection.get(promptFolderId)
    if (!promptFolder || promptFolder.kind !== config.kind) {
      throw new Error(`${config.label} folder not loaded`)
    }
    /** Shared content-creation command projected in both processes. */
    const command = config.createDomain.createCommand(
      promptFolderId,
      content,
      previousEntryId,
      categoryId
    )
    await runImmediateRendererDomainMutation({
      mutation: { command, plan: config.createDomain.plan },
      ipc: { channel: config.channels.create },
      renderer: {
        mutate: ({ collections }) => {
          config.insertClientStateOptimistically(collections, content.id)
        },
        clientStateCollections: [
          { utils: { acceptMutations: config.acceptClientStateMutations } }
        ]
      }
    })
  }

  /** Paced autosave options shared by prompts and templates. */
  type PacedOptions = {
    contentId: string
    debounceMs: number
    mutateContent: (content: Draft<TPersisted>) => void
  }

  /** Persists one paced content update. */
  const mutatePacedAutosaveUpdate = ({
    contentId,
    debounceMs,
    mutateContent
  }: PacedOptions): void => {
    /** Current merged optimistic content used as the next replacement command base. */
    const content = config.getFullPersisted(contentId)
    if (!content) throw new Error(`${config.label} not loaded`)
    /** Complete desired persisted content after applying this edit. */
    const updatedContent = produce(content, mutateContent)
    mutatePacedRendererDomainMutation({
      mutation: {
        command: config.updateDomain.createCommand(updatedContent),
        plan: config.updateDomain.plan
      },
      ipc: { channel: config.channels.update },
      renderer: {
        mutate: ({ collections }) => config.markClientStateEdited(collections, contentId),
        clientStateCollections: [
          { utils: { acceptMutations: config.acceptClientStateMutations } }
        ]
      },
      pacing: {
        target: { entityType, id: contentId },
        debounceMs
      }
    })
  }

  /** Deletes root-owned content and removes it from category ordering. */
  const deleteContent = async (promptFolderId: string, contentId: string): Promise<void> => {
    /** Root folder that owns the content. */
    const promptFolder = promptFolderCollection.get(promptFolderId)
    /** Full persisted content selected for deletion. */
    const content = config.getFullPersisted(contentId)
    if (!promptFolder || promptFolder.kind !== config.kind || !content) {
      throw new Error(`${config.label} not loaded`)
    }
    /** Workspace that owns the deleted content's root folder. */
    const workspace = workspaceCollection.toArray.find((candidate) =>
      candidate.entries.some((entry) => entry.id === promptFolderId)
    )
    if (!workspace) throw new Error(`${config.label} workspace not loaded`)
    /** Shared deletion command projected by renderer and main process. */
    const command = { workspaceId: workspace.id, promptFolderId, contentId }
    await runImmediateRendererDomainMutation({
      mutation: {
        command,
        plan: deletePlanner,
        selectExpectedTargets: selectMarkdownContentDeletionExpectedTargets
      },
      ipc: { channel: config.channels.delete },
      renderer: {
        mutate: ({ collections }) => {
          if (config.kind === 'prompt') {
            collections.promptClientState.delete(contentId)
          } else {
            collections.promptTemplateClientState.delete(contentId)
          }
        },
        clientStateCollections: [
          { utils: { acceptMutations: config.acceptClientStateMutations } }
        ]
      }
    })
  }

  /** Moves content to an exact root/category position and synchronizes category front matter. */
  const move = async (
    sourcePromptFolderId: string,
    destinationPromptFolderId: string,
    contentId: string,
    previousEntryId: string | null,
    categoryId: string | null = null
  ): Promise<void> => {
    /** Source root currently owning the content. */
    const source = promptFolderCollection.get(sourcePromptFolderId)
    /** Destination root and category-order owner. */
    const destination = promptFolderCollection.get(destinationPromptFolderId)
    if (!source || !destination || source.kind !== config.kind || destination.kind !== config.kind) {
      throw new Error(`${config.label} folder not loaded`)
    }
    /** Canonical renderer content moved between category positions. */
    const content = config.getContent(contentId)
    if (!content) throw new Error(`${config.label} data not loaded`)
    /** Shared command used to compute matching renderer and main-process plans. */
    const command = {
      sourcePromptFolderId,
      destinationPromptFolderId,
      contentId,
      categoryId,
      previousEntryId
    }

    await runImmediateRendererDomainMutation({
      mutation: { command, plan: movePlanner },
      ipc: { channel: config.channels.move },
      renderer: {
        mutate: ({ collections }) => config.markClientStateEdited(collections, contentId),
        clientStateCollections: [
          {
            utils: { acceptMutations: config.acceptClientStateMutations }
          }
        ]
      }
    })
  }

  return { create, mutatePacedAutosaveUpdate, delete: deleteContent, move }
}
