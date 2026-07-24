import type { Transaction } from '@tanstack/svelte-db'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import {
  getActiveMarkdownContentIds,
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
  removeEntry,
  resolveEntryInsertIndex,
  type EntryRef
} from '@shared/OrderContainer'
import type { PromptFolderKind } from '@shared/PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from '@shared/Revision'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'

type MutationOptions<TPayload> = Parameters<typeof runRevisionMutation<TPayload>>[0]
type OptimisticCollections = Parameters<MutationOptions<unknown>['mutateOptimistically']>[0][
  'collections'
]
type PersistHelpers = Parameters<MutationOptions<unknown>['persistMutations']>[0]

type ContentDraft = { id: string; title: string; fallbackTitle: string }

export type MarkdownContentRendererMutationConfig<
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted
> = {
  kind: PromptFolderKind
  label: string
  collectionId: string
  defaultFallbackTitle?: string
  channels: {
    create: string
    update: string
    delete: string
    move: string
  }
  createEntryRef: (contentId: string) => EntryRef
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
  updateFallbackTitleOptimistically: (
    collections: OptimisticCollections,
    contentId: string,
    update: (draft: ContentDraft) => void
  ) => void
  acceptDraftMutations: (transaction: Transaction<any>) => void
  reconcile: (snapshot: RevisionEnvelope<TPersisted>) => void
  deleteAuthoritative: (contentId: string) => void
}

export const createMarkdownContentRendererMutations = <
  TPersisted extends MarkdownContentPersisted,
  TFull extends TPersisted
>(
  config: MarkdownContentRendererMutationConfig<TPersisted, TFull>
) => {
  const readLatestFromTransaction = (
    transaction: Transaction<any>,
    contentId: string
  ): TPersisted => {
    const content = getLatestMutationModifiedRecord(
      transaction,
      config.collectionId,
      contentId,
      () => config.getFullPersisted(contentId)!
    )
    return config.toPersisted(content as TFull)
  }

  const create = async (
    promptFolderId: string,
    content: TFull,
    previousEntryId: string | null
  ): Promise<void> => {
    const promptFolder = promptFolderCollection.get(promptFolderId)
    if (!promptFolder || promptFolder.kind !== config.kind) {
      throw new Error(`${config.label} folder not loaded`)
    }
    const titleFields = resolvePromptTitleUpdateForPromptIds({
      promptIds: getActiveMarkdownContentIds(promptFolder, config.kind),
      lookupPrompt: config.getContent,
      promptId: content.id,
      currentFallbackTitle: content.fallbackTitle,
      nextTitle: content.title,
      defaultFallbackTitle: config.defaultFallbackTitle
    })
    const optimisticContent = { ...content, ...titleFields }

    await runRevisionMutation<CreateMarkdownContentResponsePayload<TPersisted>>({
      mutateOptimistically: ({ collections }) => {
        config.insertOptimistically(collections, optimisticContent)
        collections.promptFolder.update(promptFolderId, (draft) => {
          const insertIndex = resolveEntryInsertIndex(draft.entries, previousEntryId)
          const entries = [...draft.entries]
          entries.splice(insertIndex ?? entries.length, 0, config.createEntryRef(content.id))
          draft.entries = entries
        })
      },
      persistMutations: async ({ entities, transaction }) => {
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
          previousEntryId
        })
        if (result.success) config.acceptDraftMutations(transaction)
        return result
      },
      handleSuccessOrConflictResponse: (payload) => {
        promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
        if (payload.content) config.reconcile(payload.content)
      },
      conflictMessage: `${config.label} create conflict`
    })
  }

  type PacedOptions = Pick<
    MutationOptions<MarkdownContentRevisionResponsePayload<TPersisted>>,
    'mutateOptimistically'
  > & {
    contentId: string
    debounceMs: number
  }

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
        const latestContent = readLatestFromTransaction(transaction, contentId)
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
        if (payload.promptFolder) {
          promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
        }
        config.reconcile(payload.content)
      },
      conflictMessage: `${config.label} update conflict`
    })
  }

  const deleteContent = async (
    promptFolderId: string,
    contentId: string
  ): Promise<void> => {
    const promptFolder = promptFolderCollection.get(promptFolderId)
    const content = config.getFullPersisted(contentId)
    if (!promptFolder || promptFolder.kind !== config.kind) {
      throw new Error(`${config.label} folder not loaded`)
    }
    if (!content) throw new Error(`${config.label} not loaded`)

    await runRevisionMutation<DeleteMarkdownContentResponsePayload>({
      mutateOptimistically: ({ collections }) => {
        config.deleteOptimistically(collections, contentId)
        collections.promptFolder.update(promptFolderId, (draft) => {
          draft.entries = removeEntry(draft.entries, config.kind, contentId)
          if (config.kind === 'prompt') {
            draft.completedPromptIds = draft.completedPromptIds.filter((id) => id !== contentId)
          }
        })
      },
      persistMutations: async ({ entities, transaction }) => {
        const result = await ipcInvokeWithPayload<
          IpcMutationPayloadResult<DeleteMarkdownContentResponsePayload>,
          DeleteMarkdownContentPayload<TPersisted>
        >(config.channels.delete, {
          promptFolder: entities.promptFolder({ id: promptFolderId, data: promptFolder }),
          content: config.createEntity(entities, contentId, content)
        })
        if (result.success) config.acceptDraftMutations(transaction)
        return result
      },
      handleSuccessOrConflictResponse: (payload) => {
        promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      },
      conflictMessage: `${config.label} delete conflict`,
      onSuccess: () => config.deleteAuthoritative(contentId)
    })
  }

  const move = async (
    sourcePromptFolderId: string,
    destinationPromptFolderId: string,
    contentId: string,
    previousEntryId: string | null
  ): Promise<void> => {
    const source = promptFolderCollection.get(sourcePromptFolderId)
    const destination = promptFolderCollection.get(destinationPromptFolderId)
    if (!source || source.kind !== config.kind) {
      throw new Error(`Source ${config.label.toLowerCase()} folder not loaded`)
    }
    if (!destination || destination.kind !== config.kind) {
      throw new Error(`Destination ${config.label.toLowerCase()} folder not loaded`)
    }
    const persistedContent =
      config.getFullPersisted(contentId) ?? config.getDraftPersisted(contentId)
    if (!persistedContent) throw new Error(`${config.label} data not loaded`)

    const isSameFolder = sourcePromptFolderId === destinationPromptFolderId
    const destinationEntries = isSameFolder
      ? removeEntry(source.entries, config.kind, contentId)
      : destination.entries
    if (resolveEntryInsertIndex(destinationEntries, previousEntryId) === null) {
      throw new Error('Order-after entry not found')
    }
    const destinationContentIds = getActiveMarkdownContentIds(
      destination,
      config.kind
    ).filter((id) => id !== contentId)

    await runRevisionMutation<MoveMarkdownContentResponsePayload<TPersisted>>({
      mutateOptimistically: ({ collections }) => {
        if (isSameFolder) {
          collections.promptFolder.update(sourcePromptFolderId, (draft) => {
            const entries = removeEntry(draft.entries, config.kind, contentId)
            entries.splice(
              resolveEntryInsertIndex(entries, previousEntryId)!,
              0,
              config.createEntryRef(contentId)
            )
            draft.entries = entries
          })
          return
        }

        collections.promptFolder.update(sourcePromptFolderId, (draft) => {
          draft.entries = removeEntry(draft.entries, config.kind, contentId)
        })
        collections.promptFolder.update(destinationPromptFolderId, (draft) => {
          const entries = [...draft.entries]
          entries.splice(
            resolveEntryInsertIndex(entries, previousEntryId)!,
            0,
            config.createEntryRef(contentId)
          )
          draft.entries = entries
        })
        config.updateFallbackTitleOptimistically(collections, contentId, (draft) => {
          if (draft.title.trim().length > 0) return
          draft.fallbackTitle = resolvePromptTitleUpdateForPromptIds({
            promptIds: destinationContentIds,
            lookupPrompt: config.getContent,
            promptId: contentId,
            currentTitle: draft.title,
            currentFallbackTitle: draft.fallbackTitle,
            nextTitle: draft.title,
            defaultFallbackTitle: config.defaultFallbackTitle
          }).fallbackTitle
        })
      },
      persistMutations: async ({ entities, transaction }) => {
        const result = await ipcInvokeWithPayload<
          IpcMutationPayloadResult<MoveMarkdownContentResponsePayload<TPersisted>>,
          MoveMarkdownContentPayload<TPersisted>
        >(config.channels.move, {
          sourcePromptFolder: entities.promptFolder({ id: sourcePromptFolderId, data: source }),
          destinationPromptFolder: entities.promptFolder({
            id: destinationPromptFolderId,
            data: destination
          }),
          content: config.createEntity(entities, contentId, persistedContent),
          previousEntryId
        })
        if (result.success) config.acceptDraftMutations(transaction)
        return result
      },
      handleSuccessOrConflictResponse: (payload) => {
        promptFolderCollection.utils.upsertAuthoritative(payload.sourcePromptFolder)
        promptFolderCollection.utils.upsertAuthoritative(payload.destinationPromptFolder)
        config.reconcile(payload.content)
      },
      conflictMessage: `${config.label} move conflict`
    })
  }

  return { create, mutatePacedAutosaveUpdate, delete: deleteContent, move }
}
