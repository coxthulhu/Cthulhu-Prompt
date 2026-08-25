import type { Transaction } from '@tanstack/svelte-db'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import {
  getActiveMarkdownContentIds,
  placeMarkdownContentInCategoryOrder,
  type CreateMarkdownContentPayload,
  type CreateMarkdownContentResponsePayload,
  type DeleteMarkdownContentPayload,
  type DeleteMarkdownContentResponsePayload,
  type MarkdownContentPersisted,
  type MarkdownContentRevisionPayload,
  type MarkdownContentRevisionResponsePayload,
  type MoveMarkdownContentPayload,
  type MoveMarkdownContentResponsePayload
} from '@shared/MarkdownContent'
import {
  removeCategoryOrderEntry,
  type CategoryOrderEntryRef,
  type PromptFolderContentKind
} from '@shared/PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from '@shared/Revision'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
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
/** Editable content fields shared by prompt and template drafts. */
type ContentDraft = { id: string; title: string; fallbackTitle: string; category?: string }

/** Entity-specific adapters used by shared renderer content mutations. */
export type MarkdownContentRendererMutationConfig<
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted
> = {
  kind: PromptFolderContentKind
  label: string
  collectionId: string
  defaultFallbackTitle?: string
  channels: { create: string; update: string; delete: string; move: string }
  createEntryRef: (contentId: string) => CategoryOrderEntryRef
  getContent: (contentId: string) => ContentDraft | undefined
  getFullPersisted: (contentId: string) => TPersisted | null
  getDraftPersisted: (contentId: string) => TPersisted | null
  toPersisted: (content: TFull) => TPersisted
  createEntity: (
    entities: PersistHelpers['entities'],
    contentId: string,
    content: TPersisted
  ) => RevisionPayloadEntity<TPersisted>
  insertOptimistically: (collections: OptimisticCollections, content: TFull) => void
  deleteOptimistically: (collections: OptimisticCollections, contentId: string) => void
  updateContentOptimistically: (
    collections: OptimisticCollections,
    contentId: string,
    update: (draft: ContentDraft) => void
  ) => void
  acceptDraftMutations: (transaction: Transaction<any>) => void
  reconcile: (snapshot: RevisionEnvelope<TPersisted>) => void
  deleteAuthoritative: (contentId: string) => void
}

/** Creates category-aware prompt or template renderer mutations. */
export const createMarkdownContentRendererMutations = <
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted
>(
  config: MarkdownContentRendererMutationConfig<TPersisted, TFull>
) => {
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
    /** Collision-free title fields for the new root-owned content. */
    const titleFields = resolvePromptTitleUpdateForPromptIds({
      promptIds: getActiveMarkdownContentIds(promptFolder, config.kind),
      lookupPrompt: config.getContent,
      promptId: content.id,
      currentFallbackTitle: content.fallbackTitle,
      nextTitle: content.title,
      defaultFallbackTitle: config.defaultFallbackTitle
    })
    /** V2 reference inserted with the new content. */
    const entry = config.createEntryRef(content.id)
    /** New content and category order synchronized to the requested placement. */
    const placement = placeMarkdownContentInCategoryOrder(
      promptFolder.categoryOrder,
      { ...content, ...titleFields },
      entry,
      categoryId,
      previousEntryId
    )
    /** Optimistic content with category metadata synchronized to placement. */
    const optimisticContent: TFull = placement.content

    await runRevisionMutation<CreateMarkdownContentResponsePayload<TPersisted>>({
      mutateOptimistically: ({ collections }) => {
        config.insertOptimistically(collections, optimisticContent)
        collections.promptFolder.update(promptFolderId, (draft) => {
          draft.categoryOrder = placeMarkdownContentInCategoryOrder(
            draft.categoryOrder,
            optimisticContent,
            entry,
            categoryId,
            previousEntryId
          ).categoryOrder
        })
      },
      persistMutations: async ({ entities, transaction }) => {
        /** IPC creation result. */
        const result = await ipcInvokeWithPayload<
          IpcMutationPayloadResult<CreateMarkdownContentResponsePayload<TPersisted>>,
          CreateMarkdownContentPayload<TPersisted>
        >(config.channels.create, {
          promptFolder: entities.promptFolder({ id: promptFolderId, data: promptFolder }),
          content: config.createEntity(
            entities,
            content.id,
            config.toPersisted(optimisticContent)
          ),
          categoryId,
          previousEntryId
        })
        if (result.success) config.acceptDraftMutations(transaction)
        return result
      },
      handleSuccessOrConflictResponse: (payload) => {
        promptFolderCollection.utils.upsertManyAuthoritative(payload.promptFolders)
        if (payload.content) config.reconcile(payload.content)
      },
      conflictMessage: `${config.label} create conflict`
    })
  }

  /** Paced autosave options shared by prompts and templates. */
  type PacedOptions = Pick<
    MutationOptions<MarkdownContentRevisionResponsePayload<TPersisted>>,
    'mutateOptimistically'
  > & { contentId: string; debounceMs: number }

  /** Persists one paced content draft update. */
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
        if (result.success) config.acceptDraftMutations(transaction)
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
    /** V2 reference removed with the content. */
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
        if (result.success) config.acceptDraftMutations(transaction)
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
    /** Persisted content moved between category positions. */
    const persistedContent =
      config.getFullPersisted(contentId) ?? config.getDraftPersisted(contentId)
    if (!persistedContent) throw new Error(`${config.label} data not loaded`)
    /** V2 reference transferred between category groups or roots. */
    const entry = config.createEntryRef(contentId)
    /** Moved content and destination order synchronized to the requested placement. */
    const placement = placeMarkdownContentInCategoryOrder(
      destination.categoryOrder,
      persistedContent,
      entry,
      categoryId,
      previousEntryId
    )
    /** Content copy whose category matches its destination group. */
    const contentToMove: TPersisted = placement.content
    /** Destination IDs used to resolve blank-title fallback collisions. */
    const destinationContentIds = getActiveMarkdownContentIds(destination, config.kind).filter(
      (id) => id !== contentId
    )

    await runRevisionMutation<MoveMarkdownContentResponsePayload<TPersisted>>({
      mutateOptimistically: ({ collections }) => {
        if (sourcePromptFolderId === destinationPromptFolderId) {
          collections.promptFolder.update(sourcePromptFolderId, (draft) => {
            draft.categoryOrder = placeMarkdownContentInCategoryOrder(
              draft.categoryOrder,
              contentToMove,
              entry,
              categoryId,
              previousEntryId
            ).categoryOrder
          })
        } else {
          collections.promptFolder.update(sourcePromptFolderId, (draft) => {
            draft.categoryOrder = removeCategoryOrderEntry(draft.categoryOrder, entry)
          })
          collections.promptFolder.update(destinationPromptFolderId, (draft) => {
            draft.categoryOrder = placeMarkdownContentInCategoryOrder(
              draft.categoryOrder,
              contentToMove,
              entry,
              categoryId,
              previousEntryId
            ).categoryOrder
          })
        }
        config.updateContentOptimistically(collections, contentId, (draft) => {
          if (contentToMove.category === undefined) delete draft.category
          else draft.category = contentToMove.category
          if (
            sourcePromptFolderId !== destinationPromptFolderId &&
            draft.title.trim().length === 0
          ) {
            draft.fallbackTitle = resolvePromptTitleUpdateForPromptIds({
              promptIds: destinationContentIds,
              lookupPrompt: config.getContent,
              promptId: contentId,
              currentTitle: draft.title,
              currentFallbackTitle: draft.fallbackTitle,
              nextTitle: draft.title,
              defaultFallbackTitle: config.defaultFallbackTitle
            }).fallbackTitle
          }
        })
      },
      persistMutations: async ({ entities, transaction }) => {
        /** IPC movement result. */
        const result = await ipcInvokeWithPayload<
          IpcMutationPayloadResult<MoveMarkdownContentResponsePayload<TPersisted>>,
          MoveMarkdownContentPayload<TPersisted>
        >(config.channels.move, {
          sourcePromptFolder: entities.promptFolder({ id: sourcePromptFolderId, data: source }),
          destinationPromptFolder: entities.promptFolder({
            id: destinationPromptFolderId,
            data: destination
          }),
          content: config.createEntity(entities, contentId, contentToMove),
          categoryId,
          previousEntryId
        })
        if (result.success) config.acceptDraftMutations(transaction)
        return result
      },
      handleSuccessOrConflictResponse: (payload) => {
        promptFolderCollection.utils.upsertManyAuthoritative(payload.promptFolders)
        config.reconcile(payload.content)
      },
      conflictMessage: `${config.label} move conflict`
    })
  }

  return { create, mutatePacedAutosaveUpdate, delete: deleteContent, move }
}
