import { ipcMain } from 'electron'
import {
  parseMoveMarkdownContentDomainCommand,
  planPromptMove,
  planPromptTemplateMove,
  type CreatePromptDomainCommand,
  type CreatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import type { DomainCommandParser, DomainPlanner } from '@shared/DomainChanges'
import type { IpcRequestWithPayload } from '@shared/IpcRequest'
import {
  getActiveMarkdownContentIds,
  getMarkdownContentIds,
  type DeleteMarkdownContentPayload,
  type MarkdownContentPersisted,
  type MarkdownContentRevisionPayload
} from '@shared/MarkdownContent'
import {
  findCategoryOrderEntryCategoryId,
  insertCategoryOrderEntry,
  removeCategoryOrderEntry,
  type CategoryOrderEntryRef,
  type PromptFolder,
  type PromptFolderContentKind
} from '@shared/PromptFolder'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import type { RevisionEnvelope } from '@shared/Revision'
import type {
  AtomicDataBuilder,
  AtomicDataTransactionHandle,
  DataStoreKey
} from '../Data/AtomicDataTransaction'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import type { CommittedEntry } from '../Data/CommittedStore'
import { data } from '../Data/Data'
import { buildPromptFolderSnapshot } from '../Data/DataSnapshotHelpers'
import type { ParsedRequest } from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import type { MarkdownPersistenceFields } from '../Persistence/MarkdownPersistence'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'
import { handleMainDomainMutation } from './DomainMutation'
import {
  getPlannedMarkdownPersistenceFields,
  planMarkdownFilenamePersistenceFields,
  shouldUpdateMarkdownFilename,
  type MarkdownFilenameTarget
} from './MarkdownContentMutationHelpers'

type MutationParser<TPayload> = (
  request: unknown
) => ParsedRequest<IpcRequestWithPayload<TPayload>>

type AtomicHandle = AtomicDataTransactionHandle<DataStoreKey, unknown, number | null>

type ContentOperation<TContent extends MarkdownContentPersisted> = {
  id: string
  expectedRevision?: number
  data: TContent
  persistenceFields: MarkdownPersistenceFields
}

export type MarkdownContentMutationConfig<
  TContent extends MarkdownContentPersisted,
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand
> = {
  kind: PromptFolderContentKind
  label: string
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
  parsers: {
    update: MutationParser<MarkdownContentRevisionPayload<TContent>>
    delete: MutationParser<DeleteMarkdownContentPayload<TContent>>
  }
  defaultFallbackTitle?: string
  getContent: (contentId: string) => CommittedEntry<TContent, MarkdownPersistenceFields> | null
  buildSnapshot: (
    content: CommittedEntry<TContent, MarkdownPersistenceFields>
  ) => RevisionEnvelope<TContent>
  createEntryRef: (contentId: string) => CategoryOrderEntryRef
  updatePersisted: (
    requested: TContent,
    current: TContent,
    titleFields: Pick<TContent, 'title' | 'fallbackTitle'>
  ) => TContent
  canMove: (content: TContent) => boolean
  updateContent: (tx: AtomicDataBuilder, operation: ContentOperation<TContent>) => AtomicHandle
  updateFilename: (
    tx: AtomicDataBuilder,
    contentId: string,
    persistenceFields: MarkdownPersistenceFields
  ) => AtomicHandle
  deleteContent: (
    tx: AtomicDataBuilder,
    contentId: string,
    expectedRevision?: number
  ) => AtomicHandle
  onDeleted?: (workspaceId: string, contentId: string) => void
}

const getFilenameGroups = (
  promptFolder: PromptFolder,
  kind: PromptFolderContentKind
): string[][] => [
  getActiveMarkdownContentIds(promptFolder, kind),
  ...(kind === 'prompt' ? [[...promptFolder.completedPromptIds]] : [])
]

export const setupMarkdownContentMutationHandlers = <
  TContent extends MarkdownContentPersisted,
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand
>(
  config: MarkdownContentMutationConfig<TContent, TCreateCommand>
): void => {
  /** Move planner selected by the IPC channel's configured markdown-content kind. */
  const movePlanner = config.kind === 'prompt' ? planPromptMove : planPromptTemplateMove
  type FilenameTarget = MarkdownFilenameTarget<TContent, MarkdownPersistenceFields>

  /** Returns unique authoritative folder snapshots for one mutation response. */
  const buildPromptFolderSnapshots = (promptFolderIds: string[]) => [
    ...new Set(promptFolderIds)
  ].flatMap((promptFolderId) => {
    /** Latest committed folder for one response ID. */
    const promptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)
    return promptFolder ? [buildPromptFolderSnapshot(promptFolder)] : []
  })

  /** Removes a category that is not owned by the destination root. */
  const normalizeContentCategory = (
    content: TContent,
    rootPromptFolder: PromptFolder
  ): TContent => {
    /** Mutable content copy normalized before persistence. */
    const normalizedContent = { ...content }
    if (
      normalizedContent.category !== undefined &&
      !rootPromptFolder.categoryOrder.categories.some(
        (category) => category.categoryId === normalizedContent.category
      )
    ) {
      delete normalizedContent.category
    }
    return normalizedContent
  }

  const planFilenames = (
    contentIds: string[],
    overridesByContentId?: Map<
      string,
      { content: TContent; persistenceFields: MarkdownPersistenceFields }
    >
  ): FilenameTarget[] =>
    planMarkdownFilenamePersistenceFields({
      contentIds,
      lookupContent: config.getContent,
      overridesByContentId
    })

  const createFilenameUpdateHandles = (
    tx: AtomicDataBuilder,
    plans: FilenameTarget[],
    excludedContentIds: Set<string>
  ): Record<string, AtomicHandle> => {
    const handles: Record<string, AtomicHandle> = {}
    for (const plan of plans) {
      if (
        excludedContentIds.has(plan.contentId) ||
        !shouldUpdateMarkdownFilename(plan, config.getContent)
      ) {
        continue
      }
      handles[`${config.kind}Filename:${plan.contentId}`] = config.updateFilename(
        tx,
        plan.contentId,
        plan.persistenceFields
      )
    }
    return handles
  }

  handleMainDomainMutation({
    ipc: { channel: config.channels.create },
    mutation: config.createDomain
  })

  ipcMain.handle(config.channels.delete, async (_, request: unknown) => {
    return await runMutationIpcRequest(request, config.parsers.delete, async (validatedRequest) => {
      try {
        const { promptFolder: requestedFolder, content: requestedContent } =
          validatedRequest.payload
        const promptFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        const contentId = requestedContent.id
        const content = config.getContent(contentId)
        if (
          !promptFolder ||
          promptFolder.committed.kind !== config.kind ||
          !content ||
          !getMarkdownContentIds(promptFolder.committed, config.kind).includes(contentId)
        ) {
          return buildConflictResponseFromLatest(
            data.promptFolder.committedStore.getEntry(requestedFolder.id),
            `${config.label} folder not loaded`,
            (latestFolder) => ({
              promptFolders: [buildPromptFolderSnapshot(latestFolder)],
              ...(content ? { content: config.buildSnapshot(content) } : {})
            })
          )
        }
        /** Category-order reference removed with the content. */
        const categoryOrderEntry = config.createEntryRef(contentId)

        const filenamePlans = getFilenameGroups(promptFolder.committed, config.kind).flatMap(
          (contentIds) => planFilenames(contentIds.filter((id) => id !== contentId))
        )
        const outcome = (await runAtomicDataTransaction((tx) => ({
          promptFolder: tx.promptFolder.update({
            id: requestedFolder.id,
            expectedRevision: requestedFolder.expectedRevision,
            recipe: (draft) => {
              if (config.kind === 'prompt') {
                draft.completedPromptIds = draft.completedPromptIds.filter(
                  (id) => id !== contentId
                )
              }
              draft.categoryOrder = removeCategoryOrderEntry(
                draft.categoryOrder,
                categoryOrderEntry
              )
            }
          }),
          content: config.deleteContent(tx, contentId, requestedContent.expectedRevision),
          ...createFilenameUpdateHandles(tx, filenamePlans, new Set([contentId]))
        })))!

        if (outcome.status === 'conflict') {
          return buildConflictResponseFromLatest(
            data.promptFolder.committedStore.getEntry(requestedFolder.id),
            `${config.label} folder not loaded`,
            () => ({
              promptFolders: buildPromptFolderSnapshots([requestedFolder.id]),
              content: config.buildSnapshot(config.getContent(contentId)!)
            })
          )
        }
        config.onDeleted?.(promptFolder.persistenceFields.workspaceId, contentId)
        const updatedFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        return updatedFolder
          ? {
              success: true,
              payload: {
                promptFolders: buildPromptFolderSnapshots([requestedFolder.id])
              }
            }
          : { success: false, error: `${config.label} delete commit did not complete` }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
  })

  ipcMain.handle(config.channels.update, async (_, request: unknown) => {
    return await runMutationIpcRequest(request, config.parsers.update, async (validatedRequest) => {
      try {
        const requestedContent = validatedRequest.payload.content
        const content = config.getContent(requestedContent.id)
        if (!content) return { success: false, error: `${config.label} not loaded` }
        const promptFolder = data.promptFolder.committedStore.getEntry(
          content.persistenceFields.promptFolderId
        )
        if (
          !promptFolder ||
          promptFolder.committed.kind !== config.kind
        ) {
          return { success: false, error: `${config.label} folder not loaded` }
        }
        const titleFields = resolvePromptTitleUpdateForPromptIds({
          promptIds: getActiveMarkdownContentIds(promptFolder.committed, config.kind),
          lookupPrompt: (contentId) => config.getContent(contentId)?.committed ?? null,
          promptId: requestedContent.id,
          currentTitle: content.committed.title,
          currentFallbackTitle: requestedContent.data.fallbackTitle,
          nextTitle: requestedContent.data.title,
          defaultFallbackTitle: config.defaultFallbackTitle
        })
        const updatedContent = normalizeContentCategory(
          config.updatePersisted(requestedContent.data, content.committed, titleFields),
          promptFolder.committed
        )
        /** Category-order reference for the updated prompt or template. */
        const categoryOrderEntry = config.createEntryRef(requestedContent.id)
        /** Current folder-order category assignment, or undefined when the entry is absent. */
        const currentCategoryId = findCategoryOrderEntryCategoryId(
          promptFolder.committed.categoryOrder,
          categoryOrderEntry
        )
        /** Whether active-status ownership requires a folder-order update. */
        const shouldUpdateCategoryOrder = config.canMove(updatedContent)
          ? currentCategoryId === undefined ||
            currentCategoryId !== (updatedContent.category ?? null)
          : currentCategoryId !== undefined
        const filenameIds =
          getFilenameGroups(promptFolder.committed, config.kind).find((ids) =>
            ids.includes(requestedContent.id)
          ) ?? []
        const filenamePlans = planFilenames(
          filenameIds,
          new Map([
            [
              requestedContent.id,
              { content: updatedContent, persistenceFields: content.persistenceFields }
            ]
          ])
        )
        const outcome = (await runAtomicDataTransaction((tx) => ({
          content: config.updateContent(tx, {
            id: requestedContent.id,
            expectedRevision: requestedContent.expectedRevision,
            data: updatedContent,
            persistenceFields: getPlannedMarkdownPersistenceFields(
              filenamePlans,
              requestedContent.id
            )
          }),
          ...(shouldUpdateCategoryOrder
            ? {
                rootPromptFolder: tx.promptFolder.update({
                  id: promptFolder.committed.id,
                  recipe: (draft) => {
                    draft.categoryOrder = config.canMove(updatedContent)
                      ? insertCategoryOrderEntry(
                          draft.categoryOrder,
                          categoryOrderEntry,
                          updatedContent.category ?? null,
                          null
                        )
                      : removeCategoryOrderEntry(draft.categoryOrder, categoryOrderEntry)
                  }
                })
              }
            : {}),
          ...createFilenameUpdateHandles(tx, filenamePlans, new Set([requestedContent.id]))
        })))!

        if (outcome.status === 'conflict') {
          return buildConflictResponseFromLatest(
            config.getContent(requestedContent.id),
            `${config.label} not loaded`,
            (latestContent) => ({
              content: config.buildSnapshot(latestContent),
              promptFolders: buildPromptFolderSnapshots([promptFolder.committed.id])
            })
          )
        }
        const committedContent = config.getContent(requestedContent.id)
        const committedFolder = data.promptFolder.committedStore.getEntry(
          promptFolder.committed.id
        )
        if (!committedContent || !committedFolder) {
          return { success: false, error: `${config.label} update commit did not complete` }
        }
        return {
          success: true,
          payload: {
            promptFolders: buildPromptFolderSnapshots([promptFolder.committed.id]),
            content: config.buildSnapshot(committedContent)
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
  })

  handleMainDomainMutation({
    ipc: { channel: config.channels.move },
    mutation: {
      parseCommand: parseMoveMarkdownContentDomainCommand,
      plan: movePlanner
    }
  })
}
