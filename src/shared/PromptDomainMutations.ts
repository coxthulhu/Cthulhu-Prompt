import type { DomainChange, DomainPlanner, DomainTarget } from './DomainChanges'
import { parseIsoSecondTimestamp } from './isoTimestamp'
import { placeMarkdownContentInCategoryOrder } from './MarkdownContent'
import { promptEntryRef } from './OrderContainer'
import {
  PromptStatus,
  type PromptCategoryOrderPlacement,
  type PromptPersisted
} from './Prompt'
import { getActiveMarkdownContentIds } from './MarkdownContent'
import { removeCategoryOrderEntry } from './PromptFolder'

/** Renderer-authored command for changing one prompt's workflow status. */
export type SetPromptStatusDomainCommand = {
  sourcePromptFolderId: string
  destinationPromptFolderId: string
  promptId: string
  status: PromptStatus
  categoryOrderPlacement: PromptCategoryOrderPlacement
  modifiedAt: string
}

/** Parses one exact category-order placement object. */
const parsePromptCategoryOrderPlacement = (
  value: unknown
): PromptCategoryOrderPlacement | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw placement fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    (record.categoryId !== null && typeof record.categoryId !== 'string') ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string')
  ) {
    return null
  }
  return { categoryId: record.categoryId, previousEntryId: record.previousEntryId }
}

/** Strict runtime parser for prompt-status commands. */
export const parseSetPromptStatusDomainCommand = (
  value: unknown
): SetPromptStatusDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  /** Validated Active-tree placement carried by the command. */
  const categoryOrderPlacement = parsePromptCategoryOrderPlacement(
    record.categoryOrderPlacement
  )
  if (
    Object.keys(record).length !== 6 ||
    typeof record.sourcePromptFolderId !== 'string' ||
    typeof record.destinationPromptFolderId !== 'string' ||
    typeof record.promptId !== 'string' ||
    (record.status !== PromptStatus.Todo &&
      record.status !== PromptStatus.InProgress &&
      record.status !== PromptStatus.Completed) ||
    !categoryOrderPlacement ||
    parseIsoSecondTimestamp(record.modifiedAt) === null
  ) {
    return null
  }
  return {
    sourcePromptFolderId: record.sourcePromptFolderId,
    destinationPromptFolderId: record.destinationPromptFolderId,
    promptId: record.promptId,
    status: record.status,
    categoryOrderPlacement,
    modifiedAt: record.modifiedAt as string
  }
}

/** Plans prompt status, completion ownership, and Active-tree placement together. */
export const planSetPromptStatusDomainMutation: DomainPlanner<
  SetPromptStatusDomainCommand
> = (state, command) => {
  /** Prompt root that currently owns the prompt representation. */
  const sourcePromptFolder = state.get('promptFolder', command.sourcePromptFolderId)
  /** Prompt root that will own the requested status representation. */
  const destinationPromptFolder = state.get(
    'promptFolder',
    command.destinationPromptFolderId
  )
  /** Prompt receiving the requested workflow status. */
  const prompt = state.get('prompt', command.promptId)
  /** Folder and prompt targets returned for status conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'promptFolder', id: command.sourcePromptFolderId },
    ...(command.destinationPromptFolderId === command.sourcePromptFolderId
      ? []
      : [
          {
            entityType: 'promptFolder' as const,
            id: command.destinationPromptFolderId
          }
        ]),
    { entityType: 'prompt', id: command.promptId }
  ]
  if (
    !sourcePromptFolder ||
    sourcePromptFolder.kind !== 'prompt' ||
    !destinationPromptFolder ||
    destinationPromptFolder.kind !== 'prompt' ||
    !prompt
  ) {
    return { status: 'conflict', reason: 'Prompt status conflict', targets }
  }

  /** Whether the prompt is currently represented by the Completed hierarchy. */
  const isCompletedPrompt = prompt.status === PromptStatus.Completed
  /** Whether root ordering agrees with the prompt's current status. */
  const hasExpectedOwnership = isCompletedPrompt
    ? sourcePromptFolder.completedPromptIds.includes(command.promptId)
    : getActiveMarkdownContentIds(sourcePromptFolder, 'prompt').includes(command.promptId)
  if (!hasExpectedOwnership) {
    return { status: 'conflict', reason: 'Prompt status ownership conflict', targets }
  }

  /** Requested placement normalized to an existing category group. */
  const categoryOrderPlacement = destinationPromptFolder.categoryOrder.categories.some(
    (group) => group.categoryId === command.categoryOrderPlacement.categoryId
  )
    ? command.categoryOrderPlacement
    : { categoryId: null, previousEntryId: null }
  /** Current prompt without its status-specific completion timestamp. */
  const { completedAt: _completedAt, ...activePromptBase } = prompt
  /** Prompt fields after applying the requested status and timestamp. */
  const statusPrompt: PromptPersisted =
    command.status === PromptStatus.Completed
      ? {
          ...(activePromptBase as PromptPersisted),
          status: PromptStatus.Completed,
          completedAt: command.modifiedAt,
          modifiedAt: command.modifiedAt
        }
      : {
          ...(activePromptBase as PromptPersisted),
          status: command.status,
          modifiedAt: command.modifiedAt
        }
  /** Category-order reference removed on completion and restored on activation. */
  const entry = promptEntryRef(command.promptId)

  try {
    /** Prompt whose category metadata matches its requested Active-tree placement. */
    const nextPrompt =
      command.status === PromptStatus.Completed
        ? statusPrompt
        : placeMarkdownContentInCategoryOrder(
            destinationPromptFolder.categoryOrder,
            statusPrompt,
            entry,
            categoryOrderPlacement.categoryId,
            categoryOrderPlacement.previousEntryId
          ).content
    /** Root-folder changes that transfer ownership or update it in place. */
    const promptFolderChanges: DomainChange[] =
      command.sourcePromptFolderId === command.destinationPromptFolderId
        ? [
            {
              type: 'update',
              entityType: 'promptFolder',
              id: command.sourcePromptFolderId,
              recipe: (draft) => {
                draft.completedPromptIds = draft.completedPromptIds.filter(
                  (promptId) => promptId !== command.promptId
                )
                draft.categoryOrder = removeCategoryOrderEntry(draft.categoryOrder, entry)
                if (command.status === PromptStatus.Completed) {
                  draft.completedPromptIds = [command.promptId, ...draft.completedPromptIds]
                } else {
                  draft.categoryOrder = placeMarkdownContentInCategoryOrder(
                    draft.categoryOrder,
                    nextPrompt,
                    entry,
                    categoryOrderPlacement.categoryId,
                    categoryOrderPlacement.previousEntryId
                  ).categoryOrder
                }
              }
            }
          ]
        : [
            {
              type: 'update',
              entityType: 'promptFolder',
              id: command.sourcePromptFolderId,
              recipe: (draft) => {
                draft.completedPromptIds = draft.completedPromptIds.filter(
                  (promptId) => promptId !== command.promptId
                )
                draft.categoryOrder = removeCategoryOrderEntry(draft.categoryOrder, entry)
              }
            },
            {
              type: 'update',
              entityType: 'promptFolder',
              id: command.destinationPromptFolderId,
              recipe: (draft) => {
                if (command.status === PromptStatus.Completed) {
                  draft.completedPromptIds = [command.promptId, ...draft.completedPromptIds]
                } else {
                  draft.categoryOrder = placeMarkdownContentInCategoryOrder(
                    draft.categoryOrder,
                    nextPrompt,
                    entry,
                    categoryOrderPlacement.categoryId,
                    categoryOrderPlacement.previousEntryId
                  ).categoryOrder
                }
              }
            }
          ]
    return [
      ...promptFolderChanges,
      {
        type: 'update',
        entityType: 'prompt',
        id: command.promptId,
        recipe: (draft) => {
          Object.assign(draft, nextPrompt)
          if (command.status !== PromptStatus.Completed) delete draft.completedAt
          if (nextPrompt.category === undefined) delete draft.category
        }
      }
    ]
  } catch {
    return { status: 'conflict', reason: 'Prompt status placement conflict', targets }
  }
}
