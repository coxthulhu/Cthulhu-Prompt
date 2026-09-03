export const PROMPT_HANDLE_DRAG_TYPE = 'prompt-handle'
/** Drag type reserved for category reordering targets. */
export const CATEGORY_DRAG_TYPE = 'category'

/** Sidebar status section that owns a prompt drag source or destination. */
export type PromptDragStatusSection = 'active' | 'completed' | 'archived'

export type PromptHandleDragPayload = {
  fromId: string
  sourceFolderId: string
  sourceCategoryId?: string | null
  contentKind: import('@shared/PromptFolder').PromptFolderContentKind
  /** Status section containing the dragged prompt or template. */
  statusSection: PromptDragStatusSection
}

/** Drag payload for reordering one category. */
export type CategoryDragPayload = {
  categoryId: string
}

/** Category boundary selected by a category-only drop target. */
export type CategoryDropPayload = {
  nextCategoryId: string | null
}

export type PromptHandleDropPayload = {
  folderId: string
  categoryId?: string | null
  targetEntryId: string | null
  position: 'before' | 'after'
  /** Status section containing the selected drop target. */
  statusSection: PromptDragStatusSection
}

export type PromptHandleMove = {
  sourcePromptFolderId: string
  destinationPromptFolderId: string
  promptId: string
  categoryId: string | null
  previousEntryId: string | null
}

const areEntryIdOrdersEqual = (left: string[], right: string[]): boolean => {
  return left.length === right.length && left.every((entryId, index) => entryId === right[index])
}

/** Resolves a category boundary to its predecessor and rejects no-op placements. */
export const resolveCategoryDropPreviousCategoryId = (
  categoryIds: string[],
  draggedCategoryId: string,
  nextCategoryId: string | null
): string | null | undefined => {
  /** Ordered categories after removing the dragged group. */
  const remainingCategoryIds = categoryIds.filter(
    (categoryId) => categoryId !== draggedCategoryId
  )
  /** Insertion index represented by the selected boundary. */
  const insertionIndex =
    nextCategoryId === null
      ? remainingCategoryIds.length
      : remainingCategoryIds.indexOf(nextCategoryId)
  if (insertionIndex === -1) return undefined

  /** Category predecessor persisted by the category move mutation. */
  const previousCategoryId = remainingCategoryIds[insertionIndex - 1] ?? null
  /** Category sequence produced by inserting at the selected boundary. */
  const reorderedCategoryIds = [...remainingCategoryIds]
  reorderedCategoryIds.splice(insertionIndex, 0, draggedCategoryId)

  return areEntryIdOrdersEqual(categoryIds, reorderedCategoryIds) ? undefined : previousCategoryId
}

export const resolveEntryDropPreviousEntryId = (
  draggedEntryId: string,
  dropPayload: PromptHandleDropPayload,
  destinationEntryIds: string[]
): string | null | undefined => {
  if (dropPayload.targetEntryId === draggedEntryId) return undefined
  if (dropPayload.targetEntryId === null) return null
  if (dropPayload.position === 'after') return dropPayload.targetEntryId

  const targetIndex = destinationEntryIds.indexOf(dropPayload.targetEntryId)
  if (targetIndex === -1) return undefined

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const previousEntryId = destinationEntryIds[index]
    if (previousEntryId !== draggedEntryId) return previousEntryId
  }

  return null
}

export const doesEntryDropChangeOrder = (
  sourceFolderId: string,
  destinationFolderId: string,
  sourceEntryIds: string[],
  draggedEntryId: string,
  previousEntryId: string | null
): boolean => {
  if (sourceFolderId !== destinationFolderId) return true
  const nextEntryIds = reorderEntryIds(sourceEntryIds, draggedEntryId, previousEntryId)
  return Boolean(nextEntryIds && !areEntryIdOrdersEqual(sourceEntryIds, nextEntryIds))
}

const reorderEntryIds = (
  currentEntryIds: string[],
  promptId: string,
  previousEntryId: string | null
): string[] | null => {
  const currentIndex = currentEntryIds.indexOf(promptId)
  if (currentIndex === -1) {
    return null
  }

  const nextEntryIds = [...currentEntryIds]
  nextEntryIds.splice(currentIndex, 1)

  if (previousEntryId == null) {
    nextEntryIds.unshift(promptId)
    return nextEntryIds
  }

  const previousIndex = nextEntryIds.indexOf(previousEntryId)
  if (previousIndex === -1) {
    return null
  }

  nextEntryIds.splice(previousIndex + 1, 0, promptId)
  return nextEntryIds
}

export const resolvePromptHandleDropMove = (
  sourcePromptFolderId: string,
  sourceEntryIds: string[],
  promptId: string,
  dropPayload: PromptHandleDropPayload | null,
  destinationEntryIds: string[] | null
): PromptHandleMove | null => {
  if (!dropPayload) {
    return null
  }

  if (dropPayload.targetEntryId === promptId) {
    return null
  }

  if (
    dropPayload.targetEntryId !== null &&
    dropPayload.position === 'before' &&
    !destinationEntryIds
  ) {
    return null
  }

  const previousEntryId = resolveEntryDropPreviousEntryId(
    promptId,
    dropPayload,
    destinationEntryIds ?? []
  )

  if (previousEntryId === undefined) return null

  if (
    !doesEntryDropChangeOrder(
      sourcePromptFolderId,
      dropPayload.folderId,
      sourceEntryIds,
      promptId,
      previousEntryId
    )
  ) {
    return null
  }

  return {
    sourcePromptFolderId,
    destinationPromptFolderId: dropPayload.folderId,
    promptId,
    categoryId: dropPayload.categoryId ?? null,
    previousEntryId
  }
}
