import { isPromptTemplateStatus, PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import type { DomainChange, DomainPlanner, DomainTarget } from '@shared/domain/DomainChanges'
import { parseIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { getPromptStatusFolderContentIds, placeMarkdownContentInCategoryOrder } from '@shared/domain/markdown-content/MarkdownContent'
import { promptTemplateEntryRef, promptEntryRef } from '@shared/domain/OrderContainer'
import { getPromptStatusFolderDefinition, isFinalPromptStatus, isPromptStatus, PromptStatus, type PromptLocation } from '@shared/domain/prompt/Prompt'
import { removeCategoryOrderEntry, type PromptFolderContentKind } from '@shared/domain/prompt-folder/PromptFolder'
import { DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE, resolvePromptTitleUpdateForPromptIds } from '@shared/domain/prompt/promptFallbackTitle'

/** Renderer-authored command setting the complete location of one prompt or template. */
export type SetPromptLocationDomainCommand = {
  kind: PromptFolderContentKind
  sourcePromptFolderId: string
  promptId: string
  location: PromptLocation
  modifiedAt: string
}

/** Parses the exact shared location shape, including automatic final-status ordering. */
const parsePromptLocation = (value: unknown): PromptLocation | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw location fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 4 ||
    typeof record.promptFolderId !== 'string' ||
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
    (record.kind !== 'prompt' && record.kind !== 'template') ||
    typeof record.sourcePromptFolderId !== 'string' ||
    typeof record.promptId !== 'string' ||
    !location ||
    (record.kind === 'template' ? !isPromptTemplateStatus(location.status) : !isPromptStatus(location.status)) ||
    parseIsoSecondTimestamp(record.modifiedAt) === null
  ) return null
  return { ...record, location } as SetPromptLocationDomainCommand
}

/** Plans ordering, ownership, and status metadata atomically for prompts and templates. */
export const planSetPromptLocationDomainMutation: DomainPlanner<SetPromptLocationDomainCommand> = (state, command) => {
  /** Explicit content kind and complete destination carried by the validated command. */
  const { kind, location, promptId } = command
  /** Authoritative collection selected by the command's validated content kind. */
  const entityType = kind === 'prompt' ? 'prompt' : 'promptTemplate'
  /** Canonical content whose current status determines its source layout. */
  const prompt = state.get(entityType, promptId)
  /** Claimed source root used to verify ownership. */
  const source = state.get('promptFolder', command.sourcePromptFolderId)
  /** Root receiving the complete location. */
  const destination = state.get('promptFolder', location.promptFolderId)
  /** Current physical status folder, including older template records with no status. */
  const sourceStatus = getPromptStatusFolderDefinition(prompt?.status ?? (kind === 'template' ? PromptTemplateStatus.Active : PromptStatus.Todo))
  /** Actual owner included in conflict snapshots when the renderer source is stale. */
  const actualSource = state.getAll('promptFolder').find((folder) =>
    folder.kind === kind && getPromptStatusFolderContentIds(folder, sourceStatus.id).includes(promptId)
  )
  /** Unique root targets needed to reconcile an ownership or placement conflict. */
  const targets: DomainTarget[] = [
    ...Array.from(new Set([actualSource?.id ?? command.sourcePromptFolderId, location.promptFolderId]))
      .map((id) => ({ entityType: 'promptFolder' as const, id })),
    { entityType, id: promptId }
  ]
  if (
    !source || !destination || !prompt || source.kind !== kind || destination.kind !== kind ||
    actualSource?.id !== source.id ||
    (kind === 'template' ? !isPromptTemplateStatus(location.status) : !isPromptStatus(location.status))
  ) return { status: 'conflict', reason: 'Prompt location ownership conflict', targets }

  /** Destination workflow and its category or finalization ordering. */
  const destinationStatus = getPromptStatusFolderDefinition(location.status)
  /** Destination layout used for exact placement validation. */
  const destinationLayout = destination.statusFolders[destinationStatus.id]
  /** Whether the physical owning root or status folder changes. */
  const transfersOwnership = source.id !== destination.id || sourceStatus.id !== destinationStatus.id
  /** Source layout used to resolve the current ordered category. */
  const sourceLayout = source.statusFolders[sourceStatus.id]
  /** Current ordered category, absent for automatically sorted final statuses. */
  const sourceCategory = sourceLayout.ordering === 'category'
    ? sourceLayout.categoryOrder.categories.find((group) => group.entries.some((entry) => entry.id === promptId))
    : undefined
  /** Current predecessor within the source category. */
  const sourcePreviousEntryId = sourceCategory?.entries[sourceCategory.entries.findIndex((entry) => entry.id === promptId) - 1]?.id ?? null
  /** Whether this command changes any root ordering or ownership. */
  const changesOrdering = transfersOwnership || (destinationLayout.ordering === 'category' &&
    (sourceCategory?.categoryId !== location.categoryId || sourcePreviousEntryId !== location.previousEntryId))
  /** Status changes own modified/finalized timestamps; pure moves retain their timestamps. */
  const changesStatus = (prompt.status ?? (kind === 'template' ? PromptTemplateStatus.Active : PromptStatus.Todo)) !== location.status
  /** Finalization is retained within one final status and cleared on restoration. */
  const finalizedAt = isFinalPromptStatus(location.status)
    ? !changesStatus && prompt.finalizedAt ? prompt.finalizedAt : command.modifiedAt
    : undefined
  /** Destination-safe fallback title preserves existing cross-root move behavior. */
  const fallbackTitle = source.id !== destination.id && prompt.title.trim().length === 0
    ? resolvePromptTitleUpdateForPromptIds({
        promptIds: getPromptStatusFolderContentIds(destination, destinationStatus.id).filter((id) => id !== promptId),
        lookupPrompt: (id) => state.get(entityType, id),
        promptId,
        currentTitle: prompt.title,
        currentFallbackTitle: prompt.fallbackTitle,
        nextTitle: prompt.title,
        defaultFallbackTitle: kind === 'template' ? DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE : undefined
      }).fallbackTitle
    : prompt.fallbackTitle
  /** Ordered reference shared by source removal and destination insertion. */
  const entry = kind === 'prompt' ? promptEntryRef(promptId) : promptTemplateEntryRef(promptId)

  try {
    /** Validated destination placement; final statuses retain their restoration category. */
    const placement = destinationLayout.ordering === 'category'
      ? placeMarkdownContentInCategoryOrder(destinationLayout.categoryOrder, prompt, entry, location.categoryId, location.previousEntryId)
      : null
    if (destinationLayout.ordering === 'finalizedAt' && location.previousEntryId !== null) {
      return { status: 'conflict', reason: 'Prompt location placement conflict', targets }
    }
    /** One update per affected root, even for moves between layouts in the same root. */
    const changes: DomainChange[] = changesOrdering
      ? Array.from(new Set([source.id, destination.id])).map((id) => ({
          type: 'update' as const,
          entityType: 'promptFolder' as const,
          id,
          recipe: (draft) => {
            if (id === source.id) {
              /** Source layout losing the old ordered or finalized reference. */
              const layout = draft.statusFolders[sourceStatus.id]
              if (layout.ordering === 'category') layout.categoryOrder = removeCategoryOrderEntry(layout.categoryOrder, entry)
              else layout.promptIds = layout.promptIds.filter((id) => id !== promptId)
            }
            if (id === destination.id) {
              /** Destination layout receiving the validated placement exactly once. */
              const layout = draft.statusFolders[destinationStatus.id]
              if (layout.ordering === 'category') layout.categoryOrder = placement!.categoryOrder
              else layout.promptIds = [promptId, ...layout.promptIds.filter((id) => id !== promptId)]
            }
          }
        }))
      : []
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
