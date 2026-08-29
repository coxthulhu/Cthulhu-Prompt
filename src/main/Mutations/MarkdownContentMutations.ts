import { ipcMain } from 'electron'
import {
  parseMoveMarkdownContentDomainCommand,
  planPromptMove,
  planPromptTemplateMove
} from '@shared/MarkdownContentDomainMutations'
import type { IpcRequestWithPayload } from '@shared/IpcRequest'
import {
  getActiveMarkdownContentIds,
  getMarkdownContentIds,
  placeMarkdownContentInCategoryOrder,
  type CreateMarkdownContentPayload,
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
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
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
import { resolveActivePromptFolderName } from '../Persistence/PromptPersistencePaths'
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

export type MarkdownContentMutationConfig<TContent extends MarkdownContentPersisted> = {
  kind: PromptFolderContentKind
  label: string
  channels: {
    create: string
    update: string
    delete: string
    move: string
  }
  parsers: {
    create: MutationParser<CreateMarkdownContentPayload<TContent>>
    update: MutationParser<MarkdownContentRevisionPayload<TContent>>
    delete: MutationParser<DeleteMarkdownContentPayload<TContent>>
  }
  defaultFallbackTitle?: string
  getContent: (contentId: string) => CommittedEntry<TContent, MarkdownPersistenceFields> | null
  buildSnapshot: (
    content: CommittedEntry<TContent, MarkdownPersistenceFields>
  ) => RevisionEnvelope<TContent>
  createEntryRef: (contentId: string) => CategoryOrderEntryRef
  createPersisted: (
    requested: TContent,
    titleFields: Pick<TContent, 'title' | 'fallbackTitle'>,
    now: string
  ) => TContent
  updatePersisted: (
    requested: TContent,
    current: TContent,
    titleFields: Pick<TContent, 'title' | 'fallbackTitle'>
  ) => TContent
  canMove: (content: TContent) => boolean
  createContent: (tx: AtomicDataBuilder, operation: ContentOperation<TContent>) => AtomicHandle
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
  TContent extends MarkdownContentPersisted
>(
  config: MarkdownContentMutationConfig<TContent>
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

  ipcMain.handle(config.channels.create, async (_, request: unknown) => {
    return await runMutationIpcRequest(request, config.parsers.create, async (validatedRequest) => {
      try {
        const {
          promptFolder: requestedFolder,
          content: requestedContent,
          categoryId,
          previousEntryId
        } = validatedRequest.payload
        const promptFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        const contentId = requestedContent.data.id
        if (
          !promptFolder ||
          promptFolder.committed.kind !== config.kind
        ) {
          return { success: false, error: `${config.label} folder not loaded` }
        }
        if (config.getContent(contentId)) {
          return { success: false, error: `${config.label} already exists` }
        }
        const titleFields = resolvePromptTitleUpdateForPromptIds({
          promptIds: getActiveMarkdownContentIds(promptFolder.committed, config.kind),
          lookupPrompt: (contentId) => config.getContent(contentId)?.committed ?? null,
          promptId: contentId,
          currentFallbackTitle: requestedContent.data.fallbackTitle,
          nextTitle: requestedContent.data.title,
          defaultFallbackTitle: config.defaultFallbackTitle
        })
        /** Category-order reference for the new prompt or template. */
        const categoryOrderEntry = config.createEntryRef(contentId)
        /** New content and category order synchronized to the requested placement. */
        const placement = placeMarkdownContentInCategoryOrder(
          promptFolder.committed.categoryOrder,
          config.createPersisted(
            requestedContent.data,
            titleFields,
            getCurrentIsoSecondTimestamp()
          ),
          categoryOrderEntry,
          categoryId,
          previousEntryId
        )
        /** Created content with category metadata synchronized to placement. */
        const content = placement.content
        const basePersistenceFields: MarkdownPersistenceFields = {
          workspaceId: promptFolder.persistenceFields.workspaceId,
          workspacePath: promptFolder.persistenceFields.workspacePath,
          folderPath: resolveActivePromptFolderName(
            promptFolder.persistenceFields.folderPath,
            promptFolder.committed.kind
          ),
          promptFolderId: requestedFolder.id,
          promptId: contentId,
          promptStem: contentId,
          needsFilenameIdSuffix: false
        }
        const filenamePlans = planFilenames(
          [...getActiveMarkdownContentIds(promptFolder.committed, config.kind), contentId],
          new Map([[contentId, { content, persistenceFields: basePersistenceFields }]])
        )
        const outcome = (await runAtomicDataTransaction((tx) => ({
          promptFolder: tx.promptFolder.update({
            id: requestedFolder.id,
            expectedRevision: requestedFolder.expectedRevision,
            recipe: (draft) => {
              draft.categoryOrder = placeMarkdownContentInCategoryOrder(
                draft.categoryOrder,
                content,
                categoryOrderEntry,
                categoryId,
                previousEntryId
              ).categoryOrder
            }
          }),
          content: config.createContent(tx, {
            id: contentId,
            data: content,
            persistenceFields: getPlannedMarkdownPersistenceFields(filenamePlans, contentId)
          }),
          ...createFilenameUpdateHandles(tx, filenamePlans, new Set([contentId]))
        })))!

        if (outcome.status === 'conflict') {
          return buildConflictResponseFromLatest(
            data.promptFolder.committedStore.getEntry(requestedFolder.id),
            `${config.label} folder not loaded`,
            () => ({
              promptFolders: buildPromptFolderSnapshots([requestedFolder.id])
            })
          )
        }
        const updatedFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        const createdContent = config.getContent(contentId)
        if (!updatedFolder || !createdContent) {
          return { success: false, error: `${config.label} create commit did not complete` }
        }
        return {
          success: true,
          payload: {
            promptFolders: buildPromptFolderSnapshots([requestedFolder.id]),
            content: config.buildSnapshot(createdContent)
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
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
        /** Current V2 category assignment, or undefined when the entry is absent. */
        const currentCategoryId = findCategoryOrderEntryCategoryId(
          promptFolder.committed.categoryOrder,
          categoryOrderEntry
        )
        /** Whether active-status ownership requires a V2 category-order update. */
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
