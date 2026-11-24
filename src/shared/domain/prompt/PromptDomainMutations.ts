import { isPromptTemplateStatus, PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import type { DomainChange, DomainPlanner, DomainTarget } from '@shared/domain/DomainChanges'
import { parseIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { getPromptStatusFolderContentIds, planCategoryOrderedEntryMove } from '@shared/domain/markdown-content/MarkdownContent'
import { promptTemplateEntryRef, promptEntryRef } from '@shared/domain/OrderContainer'
import { getPromptStatusFolderDefinition, isFinalPromptStatus, isPromptStatus, PromptStatus, type PromptLocation } from '@shared/domain/prompt/Prompt'
import { collectionItemLabel, type PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/domain/prompt/promptFallbackTitle'

/** Renderer-authored command setting the complete location of one prompt or template. */
export type SetPromptLocationDomainCommand = {
  kind: PromptCollectionKind
  sourcePromptCollectionId: string
  promptId: string
  location: PromptLocation
  modifiedAt: string
}

/** Parses the exact shared location shape, including automatic final-status ordering. */
export const parsePromptLocation = (value: unknown): PromptLocation | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw location fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 4 ||
    typeof record.promptCollectionId !== 'string' ||
    (record.categoryId !== null && typeof record.categoryId !== 'string') ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string') ||
    (!isPromptStatus(record.status) && !isPromptTemplateStatus(record.status)) ||
    (isFinalPromptStatus(record.status) && record.previousEntryId !== null)
  ) return null
  return record as PromptLocation
}

/** Strictly validates the unified IPC command and template-specific status restrictions. */
export const parseSetPromptLocationDomainCommand = (value: unknown): SetPromptLocationDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated before selecting an entity collection. */
  const record = value as Record<string, unknown>
  /** Complete destination shared by all location callers. */
  const location = parsePromptLocation(record.location)
  if (
    Object.keys(record).length !== 5 ||
    (record.kind !== 'prompt' && record.kind !== 'template' && record.kind !== 'routine') ||
    typeof record.sourcePromptCollectionId !== 'string' ||
    typeof record.promptId !== 'string' ||
    !location ||
    (record.kind !== 'prompt' ? !isPromptTemplateStatus(location.status) : !isPromptStatus(location.status)) ||
    parseIsoSecondTimestamp(record.modifiedAt) === null
  ) return null
  return { ...record, location } as SetPromptLocationDomainCommand
}

/** Plans ordering, ownership, and status metadata atomically for prompts and templates. */
export const planSetPromptLocationDomainMutation: DomainPlanner<SetPromptLocationDomainCommand> = (state, command) => {
  /** Explicit content kind and complete destination carried by the validated command. */
  const { kind, location, promptId } = command
  /** Authoritative collection selected by the command's validated content kind. */
  const entityType = kind === 'template' ? 'promptTemplate' : 'prompt'
  /** Canonical content whose current status determines its source layout. */
  const prompt = state.get(entityType, promptId)
  /** Claimed source collection used to verify ownership. */
  const source = state.get('promptCollection', command.sourcePromptCollectionId)
  /** Collection receiving the complete location. */
  const destination = state.get('promptCollection', location.promptCollectionId)
  /** Current physical status folder, including older template records with no status. */
  const sourceStatus = getPromptStatusFolderDefinition(prompt?.status ?? (kind === 'template' ? PromptTemplateStatus.Active : PromptStatus.Todo))
  /** Actual owner included in conflict snapshots when the renderer source is stale. */
  const actualSource = state.getAll('promptCollection').find((collection) =>
    collection.kind === kind && getPromptStatusFolderContentIds(collection, sourceStatus.id).includes(promptId)
  )
  /** Unique collection targets needed to reconcile an ownership or placement conflict. */
  const targets: DomainTarget[] = [
    ...Array.from(new Set([actualSource?.id ?? command.sourcePromptCollectionId, location.promptCollectionId]))
      .map((id) => ({ entityType: 'promptCollection' as const, id })),
    { entityType, id: promptId }
  ]
  if (
    !source || !destination || !prompt || source.kind !== kind || destination.kind !== kind ||
    actualSource?.id !== source.id ||
    (kind !== 'prompt' ? !isPromptTemplateStatus(location.status) : !isPromptStatus(location.status))
  ) return { status: 'conflict', reason: 'Prompt location ownership conflict', targets }

  /** Destination workflow and its category or finalization ordering. */
  const destinationStatus = getPromptStatusFolderDefinition(location.status)
  /** Status changes own modified/finalized timestamps; pure moves retain their timestamps. */
  const changesStatus = (prompt.status ?? (kind === 'template' ? PromptTemplateStatus.Active : PromptStatus.Todo)) !== location.status
  /** Finalization is retained within one final status and cleared on restoration. */
  const finalizedAt = isFinalPromptStatus(location.status)
    ? !changesStatus && prompt.finalizedAt ? prompt.finalizedAt : command.modifiedAt
    : undefined
  /** Destination-safe fallback title preserves existing cross-collection move behavior. */
  const fallbackTitle = source.id !== destination.id && prompt.title.trim().length === 0
    ? resolvePromptTitleUpdateForPromptIds({
        promptIds: getPromptStatusFolderContentIds(destination, destinationStatus.id).filter((id) => id !== promptId),
        lookupPrompt: (id) => state.get(entityType, id),
        promptId,
        currentTitle: prompt.title,
        currentFallbackTitle: prompt.fallbackTitle,
        nextTitle: prompt.title,
        defaultFallbackTitle: `New ${collectionItemLabel[kind]}`
      }).fallbackTitle
    : prompt.fallbackTitle
  /** Ordered reference shared by source removal and destination insertion. */
  const entry = kind === 'template' ? promptTemplateEntryRef(promptId) : promptEntryRef(promptId)

  try {
    /** Collection layout updates, empty when the content already sits at this location. */
    const changes: DomainChange[] = planCategoryOrderedEntryMove({
      source,
      sourceStatusFolderId: sourceStatus.id,
      destination,
      destinationStatusFolderId: destinationStatus.id,
      entry,
      content: prompt,
      categoryId: location.categoryId,
      previousEntryId: location.previousEntryId,
      finalizedIdsKey: 'promptIds'
    })
    changes.push({
      type: 'update',
      entityType,
      id: promptId,
      recipe: (draft) => {
        draft.status = location.status
        draft.fallbackTitle = fallbackTitle
        if (changesStatus) draft.modifiedAt = command.modifiedAt
        if (location.categoryId === null) delete draft.category
        else draft.category = location.categoryId
        if (finalizedAt) draft.finalizedAt = finalizedAt
        else delete draft.finalizedAt
      }
    } as DomainChange)
    return changes
  } catch {
    return { status: 'conflict', reason: 'Prompt location placement conflict', targets }
  }
}
