import type {
  DomainChange,
  DomainMutationConflict,
  DomainPlanner,
  DomainState,
  DomainTarget
} from './DomainChanges'
import {
  deleteCategoryOrderGroup,
  getCategoryOrderCategoryIds,
  removeCategoryOrderEntry,
  type CategoryOrderEntryRef,
  type PromptFolder,
  type PromptFolderContentKind
} from './PromptFolder'
import { getActiveMarkdownContentIds, placeMarkdownContentInCategoryOrder } from './MarkdownContent'
import { promptEntryRef, promptTemplateEntryRef } from './OrderContainer'
import { PromptStatus } from './Prompt'
import {
  DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE,
  resolvePromptTitleUpdateForPromptIds
} from './promptFallbackTitle'

/** Renderer-authored command for deleting one root-owned category. */
export type DeleteCategoryDomainCommand = {
  categoryId: string
  promptFolderId: string
  modifiedAt: string
}

/** Command for moving one prompt or template to an exact category-order position. */
export type MoveMarkdownContentDomainCommand = {
  kind: PromptFolderContentKind
  sourcePromptFolderId: string
  destinationPromptFolderId: string
  contentId: string
  categoryId: string | null
  previousEntryId: string | null
}

/** Adds a target once while preserving the caller's meaningful order. */
const addUniqueTarget = (targets: DomainTarget[], target: DomainTarget): void => {
  /** Stable key for the candidate target. */
  const targetKey = `${target.entityType}:${target.id}`
  if (targets.some((candidate) => `${candidate.entityType}:${candidate.id}` === targetKey)) return
  targets.push(target)
}

/** Builds a planner conflict with a unique authoritative target set. */
const createConflict = (reason: string, targets: DomainTarget[]): DomainMutationConflict => ({
  status: 'conflict',
  reason,
  targets
})

/** Returns every domain target affected by deleting one category. */
const collectCategoryDeletionTargets = (
  state: DomainState,
  categoryId: string,
  owningFolder: PromptFolder | undefined,
  fallbackFolderId: string
): DomainTarget[] => {
  /** Correct authoritative target set for the deletion attempt. */
  const targets: DomainTarget[] = []
  addUniqueTarget(targets, {
    entityType: 'promptFolder',
    id: owningFolder?.id ?? fallbackFolderId
  })
  addUniqueTarget(targets, { entityType: 'category', id: categoryId })
  for (const prompt of state.getAll('prompt')) {
    if (prompt.category === categoryId) {
      addUniqueTarget(targets, { entityType: 'prompt', id: prompt.id })
    }
  }
  for (const promptTemplate of state.getAll('promptTemplate')) {
    if (promptTemplate.category === categoryId) {
      addUniqueTarget(targets, { entityType: 'promptTemplate', id: promptTemplate.id })
    }
  }
  return targets
}

/** Plans category deletion and reference cleanup against the supplied domain graph. */
export const planDeleteCategoryDomainMutation: DomainPlanner<
  DeleteCategoryDomainCommand
> = (state, command) => {
  /** Category selected by the renderer-authored command. */
  const category = state.get('category', command.categoryId)
  /** Authoritative root currently owning the category group. */
  const owningFolder = state
    .getAll('promptFolder')
    .find((folder) =>
      getCategoryOrderCategoryIds(folder.categoryOrder).includes(command.categoryId)
    )
  /** Correct target set used by successful planning and invariant conflicts. */
  const targets = collectCategoryDeletionTargets(
    state,
    command.categoryId,
    owningFolder,
    command.promptFolderId
  )

  if (!category || !owningFolder || owningFolder.id !== command.promptFolderId) {
    return createConflict('Category ownership conflict', targets)
  }

  /** Shared domain changes for ownership, deletion, and reference cleanup. */
  const changes: DomainChange[] = [
    {
      type: 'update',
      entityType: 'promptFolder',
      id: owningFolder.id,
      recipe: (draft) => {
        draft.categoryOrder = deleteCategoryOrderGroup(
          draft.categoryOrder,
          command.categoryId
        )
      }
    },
    { type: 'delete', entityType: 'category', id: command.categoryId }
  ]

  for (const target of targets) {
    if (target.entityType === 'prompt') {
      changes.push({
        type: 'update',
        entityType: 'prompt',
        id: target.id,
        recipe: (draft) => {
          delete draft.category
          draft.modifiedAt = command.modifiedAt
        }
      })
    }
    if (target.entityType === 'promptTemplate') {
      changes.push({
        type: 'update',
        entityType: 'promptTemplate',
        id: target.id,
        recipe: (draft) => {
          delete draft.category
          draft.modifiedAt = command.modifiedAt
        }
      })
    }
  }

  return changes
}

/** Returns the ordered reference corresponding to a prompt or template command. */
const createContentEntryRef = (
  kind: PromptFolderContentKind,
  contentId: string
): CategoryOrderEntryRef =>
  kind === 'prompt' ? promptEntryRef(contentId) : promptTemplateEntryRef(contentId)

/** Summary-compatible markdown fields required by the shared movement planner. */
type MarkdownContentDomainProjection = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  category?: string
  status?: PromptStatus
}

/** Reads one prompt or template projection from shared domain state. */
const getMarkdownContent = (
  state: DomainState,
  kind: PromptFolderContentKind,
  contentId: string
): MarkdownContentDomainProjection | undefined =>
  kind === 'prompt'
    ? state.get('prompt', contentId)
    : state.get('promptTemplate', contentId)

/** Returns the authoritative targets relevant to one content movement attempt. */
const collectMoveTargets = (
  sourcePromptFolderId: string,
  destinationPromptFolderId: string,
  contentId: string,
  kind: PromptFolderContentKind
): DomainTarget[] => {
  /** Ordered unique movement target set. */
  const targets: DomainTarget[] = []
  addUniqueTarget(targets, { entityType: 'promptFolder', id: sourcePromptFolderId })
  addUniqueTarget(targets, { entityType: 'promptFolder', id: destinationPromptFolderId })
  addUniqueTarget(targets, {
    entityType: kind === 'prompt' ? 'prompt' : 'promptTemplate',
    id: contentId
  })
  return targets
}

/** Plans prompt or template movement against renderer or main authoritative state. */
export const planMoveMarkdownContentDomainMutation: DomainPlanner<
  MoveMarkdownContentDomainCommand
> = (state, command) => {
  /** Requested source folder from the movement command. */
  const requestedSource = state.get('promptFolder', command.sourcePromptFolderId)
  /** Requested destination folder from the movement command. */
  const destination = state.get('promptFolder', command.destinationPromptFolderId)
  /** Canonical content projection selected for movement. */
  const content = getMarkdownContent(state, command.kind, command.contentId)
  /** Actual root containing the requested active content reference. */
  const actualSource = state
    .getAll('promptFolder')
    .find(
      (folder) =>
        folder.kind === command.kind &&
        getActiveMarkdownContentIds(folder, command.kind).includes(command.contentId)
    )
  /** Correct source used for invariant-conflict reconciliation. */
  const conflictSourceId = actualSource?.id ?? requestedSource?.id ?? command.sourcePromptFolderId
  /** Correct authoritative movement target set. */
  const targets = collectMoveTargets(
    conflictSourceId,
    command.destinationPromptFolderId,
    command.contentId,
    command.kind
  )
  /** Whether a prompt is active and therefore eligible for movement. */
  const canMoveContent =
    command.kind === 'template' || content?.status !== PromptStatus.Completed

  if (
    !requestedSource ||
    !destination ||
    requestedSource.kind !== command.kind ||
    destination.kind !== command.kind ||
    !content ||
    !actualSource ||
    actualSource.id !== requestedSource.id ||
    !canMoveContent
  ) {
    return createConflict('Markdown content ownership conflict', targets)
  }

  /** Entry reference transferred between category groups or root folders. */
  const entry = createContentEntryRef(command.kind, command.contentId)
  /** Destination IDs used to resolve blank-title fallback collisions. */
  const destinationContentIds = getActiveMarkdownContentIds(destination, command.kind).filter(
    (contentId) => contentId !== command.contentId
  )
  /** Cross-root content projection with a destination-safe fallback title. */
  const contentWithDestinationFallback =
    requestedSource.id !== destination.id && content.title.trim().length === 0
      ? {
          ...content,
          fallbackTitle: resolvePromptTitleUpdateForPromptIds({
            promptIds: destinationContentIds,
            lookupPrompt: (contentId) => getMarkdownContent(state, command.kind, contentId),
            promptId: command.contentId,
            currentTitle: content.title,
            currentFallbackTitle: content.fallbackTitle,
            nextTitle: content.title,
            defaultFallbackTitle:
              command.kind === 'template'
                ? DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE
                : undefined
          }).fallbackTitle
        }
      : content

  try {
    /** Destination placement validates category and predecessor invariants. */
    const placement = placeMarkdownContentInCategoryOrder(
      destination.categoryOrder,
      contentWithDestinationFallback,
      entry,
      command.categoryId,
      command.previousEntryId
    )
    /** Domain changes shared by renderer optimism and main persistence. */
    const changes: DomainChange[] = []

    if (requestedSource.id === destination.id) {
      changes.push({
        type: 'update',
        entityType: 'promptFolder',
        id: requestedSource.id,
        recipe: (draft) => {
          draft.categoryOrder = placeMarkdownContentInCategoryOrder(
            draft.categoryOrder,
            placement.content,
            entry,
            command.categoryId,
            command.previousEntryId
          ).categoryOrder
        }
      })
    } else {
      changes.push(
        {
          type: 'update',
          entityType: 'promptFolder',
          id: requestedSource.id,
          recipe: (draft) => {
            draft.categoryOrder = removeCategoryOrderEntry(draft.categoryOrder, entry)
          }
        },
        {
          type: 'update',
          entityType: 'promptFolder',
          id: destination.id,
          recipe: (draft) => {
            draft.categoryOrder = placeMarkdownContentInCategoryOrder(
              draft.categoryOrder,
              placement.content,
              entry,
              command.categoryId,
              command.previousEntryId
            ).categoryOrder
          }
        }
      )
    }

    changes.push({
      type: 'update',
      entityType: command.kind === 'prompt' ? 'prompt' : 'promptTemplate',
      id: command.contentId,
      recipe: (draft) => {
        if (placement.content.category === undefined) delete draft.category
        else draft.category = placement.content.category
        draft.fallbackTitle = placement.content.fallbackTitle
      }
    } as DomainChange)

    return changes
  } catch {
    return createConflict('Markdown content placement conflict', targets)
  }
}
