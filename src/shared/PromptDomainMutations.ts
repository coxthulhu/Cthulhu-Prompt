import type { DomainChange, DomainPlanner, DomainTarget } from './DomainChanges'
import { parseIsoSecondTimestamp } from './isoTimestamp'
import { placeMarkdownContentInCategoryOrder } from './MarkdownContent'
import { promptEntryRef } from './OrderContainer'
import {
  getPromptStatusFolderDefinition,
  isFinalPromptStatus,
  isPromptStatus,
  PromptStatus,
  type PromptCategoryOrderPlacement,
  type PromptPersisted
} from './Prompt'
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
  /** Validated destination placement carried by the command. */
  const categoryOrderPlacement = parsePromptCategoryOrderPlacement(
    record.categoryOrderPlacement
  )
  if (
    Object.keys(record).length !== 6 ||
    typeof record.sourcePromptFolderId !== 'string' ||
    typeof record.destinationPromptFolderId !== 'string' ||
    typeof record.promptId !== 'string' ||
    !isPromptStatus(record.status) ||
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

/** Plans prompt status metadata and any required root-scoped status-folder transfer. */
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
  if (
    !sourcePromptFolder ||
    sourcePromptFolder.kind !== 'prompt' ||
    !destinationPromptFolder ||
    destinationPromptFolder.kind !== 'prompt' ||
    !prompt
  ) {
    /** Stable conflict targets available before status-folder ownership can be resolved. */
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
    return { status: 'conflict', reason: 'Prompt status conflict', targets }
  }

  /** Status-folder definition owning the prompt before this status change. */
  const sourceStatusFolder = getPromptStatusFolderDefinition(prompt.status)
  /** Status-folder definition owning the requested target status. */
  const destinationStatusFolder = getPromptStatusFolderDefinition(command.status)
  /** Whether root-scoped physical status-folder ownership actually changes. */
  const movesStatusFolder =
    sourcePromptFolder.id !== destinationPromptFolder.id ||
    sourceStatusFolder.id !== destinationStatusFolder.id
  /** Folder and prompt targets required by the exact planned mutation. */
  const targets: DomainTarget[] = [
    ...(movesStatusFolder
      ? [
          { entityType: 'promptFolder' as const, id: sourcePromptFolder.id },
          ...(destinationPromptFolder.id === sourcePromptFolder.id
            ? []
            : [
                {
                  entityType: 'promptFolder' as const,
                  id: destinationPromptFolder.id
                }
              ])
        ]
      : []),
    { entityType: 'prompt', id: command.promptId }
  ]
  /** Source layout that must contain the prompt before the mutation can apply. */
  const sourceLayout = sourcePromptFolder.statusFolders[sourceStatusFolder.id]
  /** Whether source status-folder data agrees with the prompt's current status. */
  const hasExpectedOwnership =
    sourceLayout.ordering === 'category'
      ? sourceLayout.categoryOrder.categories.some((group) =>
          group.entries.some(
            (entry) => entry.kind === 'prompt' && entry.id === command.promptId
          )
        )
      : sourceLayout.promptIds.includes(command.promptId)
  if (!hasExpectedOwnership) {
    return { status: 'conflict', reason: 'Prompt status ownership conflict', targets }
  }

  /** Destination layout selected by the target status-folder registry entry. */
  const destinationLayout = destinationPromptFolder.statusFolders[destinationStatusFolder.id]
  /** Requested placement normalized only for a destination that is manually ordered. */
  const categoryOrderPlacement =
    destinationLayout.ordering === 'category' &&
    destinationLayout.categoryOrder.categories.some(
      (group) => group.categoryId === command.categoryOrderPlacement.categoryId
    )
      ? command.categoryOrderPlacement
      : { categoryId: null, previousEntryId: null }
  /** Prompt data without the final-status timestamp controlled by this mutation. */
  const { finalizedAt: previousFinalizedAt, ...statusPromptBase } = prompt
  /** Timestamp retained only within the same final status and reset for every final-status entry. */
  const finalizedAt =
    isFinalPromptStatus(command.status)
      ? prompt.status === command.status && previousFinalizedAt
        ? previousFinalizedAt
        : command.modifiedAt
      : undefined
  /** Prompt fields after applying status and finalization metadata. */
  const statusPrompt: PromptPersisted = {
    ...(statusPromptBase as PromptPersisted),
    status: command.status,
    modifiedAt: command.modifiedAt,
    ...(finalizedAt ? { finalizedAt } : {})
  }
  /** Ordered reference transferred only when physical status-folder ownership changes. */
  const entry = promptEntryRef(command.promptId)

  try {
    /** Prompt whose category metadata follows an ordered destination transfer. */
    const nextPrompt =
      movesStatusFolder && destinationLayout.ordering === 'category'
        ? placeMarkdownContentInCategoryOrder(
            destinationLayout.categoryOrder,
            statusPrompt,
            entry,
            categoryOrderPlacement.categoryId,
            categoryOrderPlacement.previousEntryId
          ).content
        : statusPrompt
    /** Status-folder transfer changes omitted for same-root, same-status-folder updates. */
    const promptFolderChanges: DomainChange[] = movesStatusFolder
      ? sourcePromptFolder.id === destinationPromptFolder.id
        ? [
            {
              type: 'update',
              entityType: 'promptFolder',
              id: sourcePromptFolder.id,
              recipe: (draft) => {
                if (draft.kind !== 'prompt') return
                /** Draft source layout losing the prompt reference. */
                const draftSource = draft.statusFolders[sourceStatusFolder.id]
                if (draftSource.ordering === 'category') {
                  draftSource.categoryOrder = removeCategoryOrderEntry(
                    draftSource.categoryOrder,
                    entry
                  )
                } else {
                  draftSource.promptIds = draftSource.promptIds.filter(
                    (promptId) => promptId !== command.promptId
                  )
                }
                /** Draft destination layout receiving the prompt reference. */
                const draftDestination = draft.statusFolders[destinationStatusFolder.id]
                if (draftDestination.ordering === 'category') {
                  draftDestination.categoryOrder = placeMarkdownContentInCategoryOrder(
                    draftDestination.categoryOrder,
                    nextPrompt,
                    entry,
                    categoryOrderPlacement.categoryId,
                    categoryOrderPlacement.previousEntryId
                  ).categoryOrder
                } else {
                  draftDestination.promptIds = [
                    command.promptId,
                    ...draftDestination.promptIds.filter(
                      (promptId) => promptId !== command.promptId
                    )
                  ]
                }
              }
            }
          ]
        : [
            {
              type: 'update',
              entityType: 'promptFolder',
              id: sourcePromptFolder.id,
              recipe: (draft) => {
                if (draft.kind !== 'prompt') return
                /** Draft source layout losing cross-root ownership. */
                const layout = draft.statusFolders[sourceStatusFolder.id]
                if (layout.ordering === 'category') {
                  layout.categoryOrder = removeCategoryOrderEntry(layout.categoryOrder, entry)
                } else {
                  layout.promptIds = layout.promptIds.filter(
                    (promptId) => promptId !== command.promptId
                  )
                }
              }
            },
            {
              type: 'update',
              entityType: 'promptFolder',
              id: destinationPromptFolder.id,
              recipe: (draft) => {
                if (draft.kind !== 'prompt') return
                /** Draft destination layout receiving cross-root ownership. */
                const layout = draft.statusFolders[destinationStatusFolder.id]
                if (layout.ordering === 'category') {
                  layout.categoryOrder = placeMarkdownContentInCategoryOrder(
                    layout.categoryOrder,
                    nextPrompt,
                    entry,
                    categoryOrderPlacement.categoryId,
                    categoryOrderPlacement.previousEntryId
                  ).categoryOrder
                } else {
                  layout.promptIds = [
                    command.promptId,
                    ...layout.promptIds.filter(
                      (promptId) => promptId !== command.promptId
                    )
                  ]
                }
              }
            }
          ]
      : []
    return [
      ...promptFolderChanges,
      {
        type: 'update',
        entityType: 'prompt',
        id: command.promptId,
        recipe: (draft) => {
          Object.assign(draft, nextPrompt)
          if (!finalizedAt) delete draft.finalizedAt
          if (nextPrompt.category === undefined) delete draft.category
        }
      }
    ]
  } catch {
    return { status: 'conflict', reason: 'Prompt status placement conflict', targets }
  }
}
