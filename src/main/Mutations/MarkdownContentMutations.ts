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
  type MarkdownContentPersisted
} from '@shared/MarkdownContent'
import {
  removeCategoryOrderEntry,
  type CategoryOrderEntryRef,
  type PromptFolder,
  type PromptFolderContentKind
} from '@shared/PromptFolder'
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
  planMarkdownFilenamePersistenceFields,
  shouldUpdateMarkdownFilename,
  type MarkdownFilenameTarget
} from './MarkdownContentMutationHelpers'

type MutationParser<TPayload> = (
  request: unknown
) => ParsedRequest<IpcRequestWithPayload<TPayload>>

type AtomicHandle = AtomicDataTransactionHandle<DataStoreKey, unknown, number | null>

export type MarkdownContentMutationConfig<
  TContent extends MarkdownContentPersisted,
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand,
  TUpdateCommand
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
  updateDomain: {
    parseCommand: DomainCommandParser<TUpdateCommand>
    plan: DomainPlanner<TUpdateCommand>
  }
  parsers: {
    delete: MutationParser<DeleteMarkdownContentPayload<TContent>>
  }
  getContent: (contentId: string) => CommittedEntry<TContent, MarkdownPersistenceFields> | null
  buildSnapshot: (
    content: CommittedEntry<TContent, MarkdownPersistenceFields>
  ) => RevisionEnvelope<TContent>
  createEntryRef: (contentId: string) => CategoryOrderEntryRef
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
  TCreateCommand extends CreatePromptDomainCommand | CreatePromptTemplateDomainCommand,
  TUpdateCommand
>(
  config: MarkdownContentMutationConfig<TContent, TCreateCommand, TUpdateCommand>
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

  /** Plans collision-aware filenames for one persisted content group. */
  const planFilenames = (contentIds: string[]): FilenameTarget[] =>
    planMarkdownFilenamePersistenceFields({
      contentIds,
      lookupContent: config.getContent
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

  handleMainDomainMutation({
    ipc: { channel: config.channels.update },
    mutation: config.updateDomain
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

  handleMainDomainMutation({
    ipc: { channel: config.channels.move },
    mutation: {
      parseCommand: parseMoveMarkdownContentDomainCommand,
      plan: movePlanner
    }
  })
}
