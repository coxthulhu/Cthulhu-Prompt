import type { Transaction } from '@tanstack/svelte-db'
import {
  planPromptMove,
  planPromptTemplateMove,
  type CreatePromptDomainCommand,
  type CreatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import type { DomainPlanner } from '@shared/DomainChanges'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import {
  type DeleteMarkdownContentPayload,
  type DeleteMarkdownContentResponsePayload,
  type MarkdownContentPersisted,
  type MarkdownContentRevisionPayload,
  type MarkdownContentRevisionResponsePayload
} from '@shared/MarkdownContent'
import {
  removeCategoryOrderEntry,
  type CategoryOrderEntryRef,
  type PromptFolderContentKind
} from '@shared/PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from '@shared/Revision'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runImmediateRendererDomainMutation } from '../IpcFramework/RendererDomainMutation'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'

/** Revision mutation options used to derive local helper types. */
type MutationOptions<TPayload> = Parameters<typeof runRevisionMutation<TPayload>>[0]
/** Optimistic collection helpers supplied by the revision framework. */
type OptimisticCollections = Parameters<MutationOptions<unknown>['mutateOptimistically']>[0][
  'collections'
]
/** Persistence helpers supplied by the revision framework. */
type PersistHelpers = Parameters<MutationOptions<unknown>['persistMutations']>[0]
/** Canonical editable fields shared by prompts and prompt templates. */
type ContentRecord = { id: string; title: string; fallbackTitle: string; category?: string }

/** Entity-specific adapters used by shared renderer content mutations. */
export type MarkdownContentRendererMutationConfig<
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted,
  TCreateCommand
> = {
  kind: PromptFolderContentKind
  label: string
  collectionId: string
  channels: { create: string; update: string; delete: string; move: string }
  createEntryRef: (contentId: string) => CategoryOrderEntryRef
  getContent: (contentId: string) => ContentRecord | undefined
  getFullPersisted: (contentId: string) => TPersisted | null
  toPersisted: (content: TFull) => TPersisted
  createEntity: (
    entities: PersistHelpers['entities'],
    contentId: string,
    content: TPersisted
  ) => RevisionPayloadEntity<TPersisted>
  createDomain: {
    plan: DomainPlanner<TCreateCommand>
    createCommand: (
      promptFolderId: string,
      content: TFull,
      previousEntryId: string | null,
      categoryId: string | null
    ) => TCreateCommand
  }
  insertClientStateOptimistically: (
    collections: OptimisticCollections,
    contentId: string
  ) => void
  deleteOptimistically: (collections: OptimisticCollections, contentId: string) => void
  markMoveClientStateEdited: (
    collections: OptimisticCollections,
    contentId: string
  ) => void
  acceptClientStateMutations: (transaction: Transaction<any>) => void
  reconcile: (snapshot: RevisionEnvelope<TPersisted>) => void
  deleteAuthoritative: (contentId: string) => void
}

/** Creates category-aware prompt or template renderer mutations. */
export const createMarkdownContentRendererMutations = <
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted,
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand
>(
  config: MarkdownContentRendererMutationConfig<TPersisted, TFull, TCreateCommand>
) => {
  /** Move planner selected by the renderer channel's configured markdown-content kind. */
  const movePlanner = config.kind === 'prompt' ? planPromptMove : planPromptTemplateMove
  /** Reads the latest content record represented by a merged paced transaction. */
  const readLatestFromTransaction = (
    transaction: Transaction<any>,
    contentId: string
  ): TPersisted => {
    /** Latest optimistic content record. */
    const content = getLatestMutationModifiedRecord(
      transaction,
      config.collectionId,
      contentId,
      () => config.getFullPersisted(contentId)!
    )
    return config.toPersisted(content as TFull)
  }

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
  type PacedOptions = Pick<
    MutationOptions<MarkdownContentRevisionResponsePayload<TPersisted>>,
    'mutateOptimistically'
  > & { contentId: string; debounceMs: number }

  /** Persists one paced content update. */
  const mutatePacedAutosaveUpdate = ({
    contentId,
    debounceMs,
    mutateOptimistically
  }: PacedOptions): void => {
    mutatePacedRevisionUpdateTransaction<MarkdownContentRevisionResponsePayload<TPersisted>>({
      collectionId: config.collectionId,
      elementId: contentId,
      debounceMs,
      mutateOptimistically,
      persistMutations: async ({ entities, transaction }) => {
        /** Latest merged draft converted to its persisted representation. */
        const latestContent = readLatestFromTransaction(transaction, contentId)
        /** IPC autosave result. */
        const result = await ipcInvokeWithPayload<
          IpcMutationPayloadResult<MarkdownContentRevisionResponsePayload<TPersisted>>,
          MarkdownContentRevisionPayload<TPersisted>
        >(config.channels.update, {
          content: config.createEntity(entities, contentId, latestContent)
        })
        if (result.success) config.acceptClientStateMutations(transaction)
        return result
      },
      handleSuccessOrConflictResponse: (payload) => {
        promptFolderCollection.utils.upsertManyAuthoritative(payload.promptFolders)
        config.reconcile(payload.content)
      },
      conflictMessage: `${config.label} update conflict`
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
    /** Folder-order reference removed with the content. */
    const entry = config.createEntryRef(contentId)

    await runRevisionMutation<DeleteMarkdownContentResponsePayload<TPersisted>>({
      mutateOptimistically: ({ collections }) => {
        config.deleteOptimistically(collections, contentId)
        collections.promptFolder.update(promptFolderId, (draft) => {
          draft.categoryOrder = removeCategoryOrderEntry(draft.categoryOrder, entry)
          if (config.kind === 'prompt') {
            draft.completedPromptIds = draft.completedPromptIds.filter((id) => id !== contentId)
          }
        })
      },
      persistMutations: async ({ entities, transaction }) => {
        /** IPC deletion result. */
        const result = await ipcInvokeWithPayload<
          IpcMutationPayloadResult<DeleteMarkdownContentResponsePayload<TPersisted>>,
          DeleteMarkdownContentPayload<TPersisted>
        >(config.channels.delete, {
          promptFolder: entities.promptFolder({ id: promptFolderId, data: promptFolder }),
          content: config.createEntity(entities, contentId, content)
        })
        if (result.success) config.acceptClientStateMutations(transaction)
        return result
      },
      handleSuccessOrConflictResponse: (payload) => {
        promptFolderCollection.utils.upsertManyAuthoritative(payload.promptFolders)
        if (payload.content) config.reconcile(payload.content)
      },
      conflictMessage: `${config.label} delete conflict`,
      onSuccess: () => config.deleteAuthoritative(contentId)
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
        mutate: ({ collections }) => config.markMoveClientStateEdited(collections, contentId),
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
