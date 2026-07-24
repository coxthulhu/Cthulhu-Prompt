import { ipcMain } from 'electron'
import type { IpcRequestWithPayload } from '@shared/IpcRequest'
import {
  getActiveMarkdownContentIds,
  getMarkdownContentIds,
  type CreateMarkdownContentPayload,
  type DeleteMarkdownContentPayload,
  type MarkdownContentPersisted,
  type MarkdownContentRevisionPayload,
  type MoveMarkdownContentPayload
} from '@shared/MarkdownContent'
import type { EntryRef } from '@shared/OrderContainer'
import { removeEntry, resolveEntryInsertIndex } from '@shared/OrderContainer'
import type { PromptFolder, PromptFolderKind } from '@shared/PromptFolder'
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
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'
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
  kind: PromptFolderKind
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
    move: MutationParser<MoveMarkdownContentPayload<TContent>>
  }
  defaultFallbackTitle?: string
  getContent: (contentId: string) => CommittedEntry<TContent, MarkdownPersistenceFields> | null
  buildSnapshot: (
    content: CommittedEntry<TContent, MarkdownPersistenceFields>
  ) => RevisionEnvelope<TContent>
  createEntryRef: (contentId: string) => EntryRef
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
  kind: PromptFolderKind
): string[][] => [
  getActiveMarkdownContentIds(promptFolder, kind),
  ...(kind === 'prompt' ? [[...promptFolder.completedPromptIds]] : [])
]

export const setupMarkdownContentMutationHandlers = <
  TContent extends MarkdownContentPersisted
>(
  config: MarkdownContentMutationConfig<TContent>
): void => {
  type FilenameTarget = MarkdownFilenameTarget<TContent, MarkdownPersistenceFields>

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

  const buildMoveConflictResponse = (
    sourcePromptFolderId: string,
    destinationPromptFolderId: string,
    contentId: string
  ) => {
    const source = data.promptFolder.committedStore.getEntry(sourcePromptFolderId)
    const destination = data.promptFolder.committedStore.getEntry(destinationPromptFolderId)
    const content = config.getContent(contentId)
    if (!source || !destination || !content) {
      return { success: false as const, error: `${config.label} move conflict data not loaded` }
    }
    return {
      success: false as const,
      conflict: true as const,
      payload: {
        sourcePromptFolder: buildPromptFolderSnapshot(source),
        destinationPromptFolder: buildPromptFolderSnapshot(destination),
        content: config.buildSnapshot(content)
      }
    }
  }

  ipcMain.handle(config.channels.create, async (_, request: unknown) => {
    return await runMutationIpcRequest(request, config.parsers.create, async (validatedRequest) => {
      try {
        const { promptFolder: requestedFolder, content: requestedContent, previousEntryId } =
          validatedRequest.payload
        const promptFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        const contentId = requestedContent.data.id
        if (!promptFolder || promptFolder.committed.kind !== config.kind) {
          return { success: false, error: `${config.label} folder not loaded` }
        }
        if (config.getContent(contentId)) {
          return { success: false, error: `${config.label} already exists` }
        }

        const insertIndex = resolveEntryInsertIndex(
          promptFolder.committed.entries,
          previousEntryId
        )
        if (insertIndex === null) {
          return { success: false, error: `Previous ${config.label.toLowerCase()} not found` }
        }

        const titleFields = resolvePromptTitleUpdateForPromptIds({
          promptIds: getMarkdownContentIds(promptFolder.committed, config.kind),
          lookupPrompt: (contentId) => config.getContent(contentId)?.committed ?? null,
          promptId: contentId,
          currentFallbackTitle: requestedContent.data.fallbackTitle,
          nextTitle: requestedContent.data.title,
          defaultFallbackTitle: config.defaultFallbackTitle
        })
        const content = config.createPersisted(
          requestedContent.data,
          titleFields,
          getCurrentIsoSecondTimestamp()
        )
        const nextEntries = [...promptFolder.committed.entries]
        nextEntries.splice(insertIndex, 0, config.createEntryRef(contentId))
        const basePersistenceFields: MarkdownPersistenceFields = {
          workspaceId: promptFolder.persistenceFields.workspaceId,
          workspacePath: promptFolder.persistenceFields.workspacePath,
          folderPath: promptFolder.persistenceFields.folderPath,
          promptFolderId: requestedFolder.id,
          promptId: contentId,
          promptStem: contentId,
          needsFilenameIdSuffix: false
        }
        const filenamePlans = planFilenames(
          [...getActiveMarkdownContentIds(promptFolder.committed, config.kind), contentId],
          new Map([[contentId, { content, persistenceFields: basePersistenceFields }]])
        )
        const outcome = await runAtomicDataTransaction((tx) => ({
          promptFolder: tx.promptFolder.update({
            id: requestedFolder.id,
            expectedRevision: requestedFolder.expectedRevision,
            recipe: (draft) => {
              draft.entries = nextEntries
            }
          }),
          content: config.createContent(tx, {
            id: contentId,
            data: content,
            persistenceFields: getPlannedMarkdownPersistenceFields(filenamePlans, contentId)
          }),
          ...createFilenameUpdateHandles(tx, filenamePlans, new Set([contentId]))
        }))

        if (outcome.status === 'conflict') {
          return buildConflictResponseFromLatest(
            data.promptFolder.committedStore.getEntry(requestedFolder.id),
            `${config.label} folder not loaded`,
            (latestFolder) => ({ promptFolder: buildPromptFolderSnapshot(latestFolder) })
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
            promptFolder: buildPromptFolderSnapshot(updatedFolder),
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
            (latestFolder) => ({ promptFolder: buildPromptFolderSnapshot(latestFolder) })
          )
        }

        const filenamePlans = getFilenameGroups(promptFolder.committed, config.kind).flatMap(
          (contentIds) => planFilenames(contentIds.filter((id) => id !== contentId))
        )
        const outcome = await runAtomicDataTransaction((tx) => ({
          promptFolder: tx.promptFolder.update({
            id: requestedFolder.id,
            expectedRevision: requestedFolder.expectedRevision,
            recipe: (draft) => {
              draft.entries = removeEntry(draft.entries, config.kind, contentId)
              if (config.kind === 'prompt') {
                draft.completedPromptIds = draft.completedPromptIds.filter(
                  (id) => id !== contentId
                )
              }
            }
          }),
          content: config.deleteContent(tx, contentId, requestedContent.expectedRevision),
          ...createFilenameUpdateHandles(tx, filenamePlans, new Set([contentId]))
        }))

        if (outcome.status === 'conflict') {
          return buildConflictResponseFromLatest(
            data.promptFolder.committedStore.getEntry(requestedFolder.id),
            `${config.label} folder not loaded`,
            (latestFolder) => ({ promptFolder: buildPromptFolderSnapshot(latestFolder) })
          )
        }
        config.onDeleted?.(promptFolder.persistenceFields.workspaceId, contentId)
        const updatedFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
        return updatedFolder
          ? {
              success: true,
              payload: { promptFolder: buildPromptFolderSnapshot(updatedFolder) }
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
        if (!promptFolder || promptFolder.committed.kind !== config.kind) {
          return { success: false, error: `${config.label} folder not loaded` }
        }

        const titleFields = resolvePromptTitleUpdateForPromptIds({
          promptIds: getMarkdownContentIds(promptFolder.committed, config.kind),
          lookupPrompt: (contentId) => config.getContent(contentId)?.committed ?? null,
          promptId: requestedContent.id,
          currentTitle: content.committed.title,
          currentFallbackTitle: requestedContent.data.fallbackTitle,
          nextTitle: requestedContent.data.title,
          defaultFallbackTitle: config.defaultFallbackTitle
        })
        const updatedContent = config.updatePersisted(
          requestedContent.data,
          content.committed,
          titleFields
        )
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
        const outcome = await runAtomicDataTransaction((tx) => ({
          content: config.updateContent(tx, {
            id: requestedContent.id,
            expectedRevision: requestedContent.expectedRevision,
            data: updatedContent,
            persistenceFields: getPlannedMarkdownPersistenceFields(
              filenamePlans,
              requestedContent.id
            )
          }),
          ...createFilenameUpdateHandles(tx, filenamePlans, new Set([requestedContent.id]))
        }))

        if (outcome.status === 'conflict') {
          return buildConflictResponseFromLatest(
            config.getContent(requestedContent.id),
            `${config.label} not loaded`,
            (latestContent) => ({ content: config.buildSnapshot(latestContent) })
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
            promptFolder: buildPromptFolderSnapshot(committedFolder),
            content: config.buildSnapshot(committedContent)
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
  })

  ipcMain.handle(config.channels.move, async (_, request: unknown) => {
    return await runMutationIpcRequest(request, config.parsers.move, async (validatedRequest) => {
      try {
        const {
          sourcePromptFolder: requestedSource,
          destinationPromptFolder: requestedDestination,
          content: requestedContent,
          previousEntryId
        } = validatedRequest.payload
        const source = data.promptFolder.committedStore.getEntry(requestedSource.id)
        const destination = data.promptFolder.committedStore.getEntry(requestedDestination.id)
        const content = config.getContent(requestedContent.id)
        if (
          !source ||
          !destination ||
          source.committed.kind !== config.kind ||
          destination.committed.kind !== config.kind ||
          !content ||
          !config.canMove(content.committed) ||
          !getActiveMarkdownContentIds(source.committed, config.kind).includes(requestedContent.id)
        ) {
          return buildMoveConflictResponse(
            requestedSource.id,
            requestedDestination.id,
            requestedContent.id
          )
        }

        const isSameFolder = requestedSource.id === requestedDestination.id
        const destinationEntries = isSameFolder
          ? removeEntry(source.committed.entries, config.kind, requestedContent.id)
          : destination.committed.entries
        const insertIndex = resolveEntryInsertIndex(
          destinationEntries,
          previousEntryId
        )
        if (insertIndex === null) {
          return { success: false, error: `Order-after ${config.label.toLowerCase()} not found` }
        }

        const nextSourceEntries = removeEntry(
          source.committed.entries,
          config.kind,
          requestedContent.id
        )
        const nextDestinationEntries = [...destinationEntries]
        nextDestinationEntries.splice(
          insertIndex,
          0,
          config.createEntryRef(requestedContent.id)
        )
        const destinationContentIds = getActiveMarkdownContentIds(
          destination.committed,
          config.kind
        ).filter((id) => id !== requestedContent.id)
        const movedContent =
          !isSameFolder && content.committed.title.trim().length === 0
            ? {
                ...content.committed,
                fallbackTitle: resolvePromptTitleUpdateForPromptIds({
                  promptIds: destinationContentIds,
                  lookupPrompt: (contentId) => config.getContent(contentId)?.committed ?? null,
                  promptId: requestedContent.id,
                  currentTitle: content.committed.title,
                  currentFallbackTitle: content.committed.fallbackTitle,
                  nextTitle: content.committed.title,
                  defaultFallbackTitle: config.defaultFallbackTitle
                }).fallbackTitle
              }
            : content.committed
        const movedPersistenceFields: MarkdownPersistenceFields = isSameFolder
          ? content.persistenceFields
          : {
              ...content.persistenceFields,
              folderPath: destination.persistenceFields.folderPath,
              previousFolderPath: source.persistenceFields.folderPath,
              promptFolderId: requestedDestination.id
            }
        const filenamePlans = isSameFolder
          ? planFilenames(getActiveMarkdownContentIds(source.committed, config.kind))
          : [
              ...planFilenames(
                getActiveMarkdownContentIds(source.committed, config.kind).filter(
                  (id) => id !== requestedContent.id
                )
              ),
              ...planFilenames(
                [...destinationContentIds, requestedContent.id],
                new Map([
                  [
                    requestedContent.id,
                    { content: movedContent, persistenceFields: movedPersistenceFields }
                  ]
                ])
              )
            ]
        const outcome = isSameFolder
          ? await runAtomicDataTransaction((tx) => ({
              sourcePromptFolder: tx.promptFolder.update({
                id: requestedSource.id,
                expectedRevision: requestedSource.expectedRevision,
                recipe: (draft) => {
                  draft.entries = nextDestinationEntries
                }
              }),
              ...createFilenameUpdateHandles(tx, filenamePlans, new Set())
            }))
          : await runAtomicDataTransaction((tx) => ({
              sourcePromptFolder: tx.promptFolder.update({
                id: requestedSource.id,
                expectedRevision: requestedSource.expectedRevision,
                recipe: (draft) => {
                  draft.entries = nextSourceEntries
                }
              }),
              destinationPromptFolder: tx.promptFolder.update({
                id: requestedDestination.id,
                expectedRevision: requestedDestination.expectedRevision,
                recipe: (draft) => {
                  draft.entries = nextDestinationEntries
                }
              }),
              content: config.updateContent(tx, {
                id: requestedContent.id,
                expectedRevision: requestedContent.expectedRevision,
                data: movedContent,
                persistenceFields: getPlannedMarkdownPersistenceFields(
                  filenamePlans,
                  requestedContent.id
                )
              }),
              ...createFilenameUpdateHandles(tx, filenamePlans, new Set([requestedContent.id]))
            }))

        if (outcome.status === 'conflict') {
          return buildMoveConflictResponse(
            requestedSource.id,
            requestedDestination.id,
            requestedContent.id
          )
        }
        const updatedSource = data.promptFolder.committedStore.getEntry(requestedSource.id)
        const updatedDestination = data.promptFolder.committedStore.getEntry(
          requestedDestination.id
        )
        const updatedContent = config.getContent(requestedContent.id)
        if (!updatedSource || !updatedDestination || !updatedContent) {
          return { success: false, error: `${config.label} move commit did not complete` }
        }
        return {
          success: true,
          payload: {
            sourcePromptFolder: buildPromptFolderSnapshot(updatedSource),
            destinationPromptFolder: buildPromptFolderSnapshot(updatedDestination),
            content: config.buildSnapshot(updatedContent)
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
  })
}
