import type {
  DomainChange,
  DomainMutationConflict,
  DomainPlanner,
  DomainState,
  DomainTarget
} from './DomainChanges'
import {
  getActiveMarkdownContentIds,
  placeMarkdownContentInCategoryOrder
} from './MarkdownContent'
import { promptEntryRef, promptTemplateEntryRef } from './OrderContainer'
import { PromptStatus } from './Prompt'
import {
  removeCategoryOrderEntry,
  type CategoryOrderEntryRef,
  type PromptFolderContentKind
} from './PromptFolder'
import {
  DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE,
  resolvePromptTitleUpdateForPromptIds
} from './promptFallbackTitle'

/** Channel-scoped command for moving markdown content to an exact category-order position. */
export type MoveMarkdownContentDomainCommand = {
  sourcePromptFolderId: string
  destinationPromptFolderId: string
  contentId: string
  categoryId: string | null
  previousEntryId: string | null
}

/** Strict runtime parser for prompt or template movement commands. */
export const parseMoveMarkdownContentDomainCommand = (
  value: unknown
): MoveMarkdownContentDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 5 ||
    typeof record.sourcePromptFolderId !== 'string' ||
    typeof record.destinationPromptFolderId !== 'string' ||
    typeof record.contentId !== 'string' ||
    (record.categoryId !== null && typeof record.categoryId !== 'string') ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string')
  ) {
    return null
  }
  return {
    sourcePromptFolderId: record.sourcePromptFolderId,
    destinationPromptFolderId: record.destinationPromptFolderId,
    contentId: record.contentId,
    categoryId: record.categoryId,
    previousEntryId: record.previousEntryId
  }
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

/** Returns the ordered reference corresponding to a prompt or template channel. */
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

/** Creates a channel-specific movement planner without placing kind on the command wire shape. */
const createMovePlanner = (
  kind: PromptFolderContentKind
): DomainPlanner<MoveMarkdownContentDomainCommand> => (state, command) => {
  /** Requested source folder from the movement command. */
  const requestedSource = state.get('promptFolder', command.sourcePromptFolderId)
  /** Requested destination folder from the movement command. */
  const destination = state.get('promptFolder', command.destinationPromptFolderId)
  /** Canonical content projection selected by the registered movement channel. */
  const content = getMarkdownContent(state, kind, command.contentId)
  /** Actual root containing the requested active content reference. */
  const actualSource = state
    .getAll('promptFolder')
    .find(
      (folder) =>
        folder.kind === kind &&
        getActiveMarkdownContentIds(folder, kind).includes(command.contentId)
    )
  /** Correct source used for invariant-conflict reconciliation. */
  const conflictSourceId = actualSource?.id ?? requestedSource?.id ?? command.sourcePromptFolderId
  /** Correct authoritative movement target set. */
  const targets = collectMoveTargets(
    conflictSourceId,
    command.destinationPromptFolderId,
    command.contentId,
    kind
  )
  /** Whether channel-selected content is active and therefore eligible for movement. */
  const canMoveContent = kind === 'template' || content?.status !== PromptStatus.Completed

  if (
    !requestedSource ||
    !destination ||
    requestedSource.kind !== kind ||
    destination.kind !== kind ||
    !content ||
    !actualSource ||
    actualSource.id !== requestedSource.id ||
    !canMoveContent
  ) {
    return createConflict('Markdown content ownership conflict', targets)
  }

  /** Entry reference transferred between category groups or root folders. */
  const entry = createContentEntryRef(kind, command.contentId)
  /** Destination IDs used to resolve blank-title fallback collisions. */
  const destinationContentIds = getActiveMarkdownContentIds(destination, kind).filter(
    (contentId) => contentId !== command.contentId
  )
  /** Cross-root content projection with a destination-safe fallback title. */
  const contentWithDestinationFallback =
    requestedSource.id !== destination.id && content.title.trim().length === 0
      ? {
          ...content,
          fallbackTitle: resolvePromptTitleUpdateForPromptIds({
            promptIds: destinationContentIds,
            lookupPrompt: (contentId) => getMarkdownContent(state, kind, contentId),
            promptId: command.contentId,
            currentTitle: content.title,
            currentFallbackTitle: content.fallbackTitle,
            nextTitle: content.title,
            defaultFallbackTitle:
              kind === 'template' ? DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE : undefined
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
      entityType: kind === 'prompt' ? 'prompt' : 'promptTemplate',
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

/** Plans prompt movement for the prompt-specific move channel. */
export const planPromptMove = createMovePlanner('prompt')

/** Plans prompt-template movement for the prompt-template-specific move channel. */
export const planPromptTemplateMove = createMovePlanner('template')
