import { produce, type Draft } from 'immer'
import {
  planPromptDelete,
  planPromptTemplateDelete,
  type CreatePromptDomainCommand,
  type CreatePromptTemplateDomainCommand
} from '@shared/domain/markdown-content/MarkdownContentDomainMutations'
import type { DomainPlanner } from '@shared/domain/DomainChanges'
import { type MarkdownContentPersisted } from '@shared/domain/markdown-content/MarkdownContent'
import { type PromptFolderContentKind } from '@shared/domain/prompt-folder/PromptFolder'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { getAllWorkspaceFolderEntries } from '@shared/domain/workspace/Workspace'
import {
  mutatePacedRendererDomainMutation,
  runImmediateRendererDomainMutation
} from '@renderer/data/IpcFramework/RendererDomainMutation'
import { runRevisionMutation } from '@renderer/data/IpcFramework/RevisionCollections'

/** Revision mutation options used to derive local helper types. */
type MutationOptions<TPayload> = Parameters<typeof runRevisionMutation<TPayload>>[0]
/** Optimistic collection helpers supplied by the revision framework. */
type OptimisticCollections = Parameters<MutationOptions<unknown>['mutateOptimistically']>[0][
  'collections'
]

/** Entity-specific adapters used by shared renderer content mutations. */
export type MarkdownContentRendererMutationConfig<
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted,
  TCreateCommand,
  TUpdateCommand
> = {
  kind: PromptFolderContentKind
  label: string
  channels: { create: string; update: string; delete: string }
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
  markClientStateEdited: (collections: OptimisticCollections, contentId: string) => void
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
        }
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
        mutate: ({ collections }) => config.markClientStateEdited(collections, contentId)
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
      getAllWorkspaceFolderEntries(candidate).some((entry) => entry.id === promptFolderId)
    )
    if (!workspace) throw new Error(`${config.label} workspace not loaded`)
    /** Shared deletion command projected by renderer and main process. */
    const command = { workspaceId: workspace.id, promptFolderId, contentId }
    await runImmediateRendererDomainMutation({
      mutation: {
        command,
        plan: deletePlanner
      },
      ipc: { channel: config.channels.delete },
      renderer: {
        mutate: ({ collections }) => {
          if (config.kind === 'prompt') {
            collections.promptClientState.delete(contentId)
          } else {
            collections.promptTemplateClientState.delete(contentId)
          }
        }
      }
    })
  }

  return { create, mutatePacedAutosaveUpdate, delete: deleteContent }
}
