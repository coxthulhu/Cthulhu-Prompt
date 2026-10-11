import type {
  DomainChange,
  DomainMutationConflict,
  DomainPlanner,
  DomainState,
  DomainTarget
} from '@shared/domain/DomainChanges'
import {
  hasCategoryDisplayNameConflict,
  normalizeCategoryDisplayName,
  normalizeCategoryShortDescription,
  type Category
} from '@shared/domain/category/Category'
import {
  deleteCategoryOrderGroup,
  getPromptCollectionCategoryIds,
  insertCategoryOrderGroup,
  moveCategoryOrderGroup,
  type CategoryOrder,
  type PromptCollection
} from '@shared/domain/prompt-collection/PromptCollection'
import { isPromptStatusFolderId, PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import {
  createWorkspacePromptCollectionUiStateKey,
  type WorkspacePromptCollectionUiState
} from '@shared/domain/ui-state/UiState'
import { isPromptCollectionScreenSelection } from '@shared/domain/user-persistence/UserPersistence'
import { getAllWorkspaceCollectionEntries } from '@shared/domain/workspace/Workspace'

/** Renderer-authored command for creating one collection-owned category. */
export type CreateCategoryDomainCommand = {
  categoryId: string
  promptCollectionId: string
  displayName: string
  shortDescription: string | null
  description: string | null
}

/** Complete retained category value submitted by the management dialog. */
export type SaveCategoriesDomainValue = {
  id: string
  displayName: string
  shortDescription: string | null
  description: string | null
}

/** Renderer-authored command for atomically saving one collection's category drafts. */
export type SaveCategoriesDomainCommand = {
  workspaceId: string
  promptCollectionId: string
  categories: SaveCategoriesDomainValue[]
  modifiedAt: string
}

/** Strict runtime parser for atomic multi-category save commands. */
export const parseSaveCategoriesDomainCommand = (
  value: unknown
): SaveCategoriesDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 4 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.promptCollectionId !== 'string' ||
    !Array.isArray(record.categories) ||
    typeof record.modifiedAt !== 'string'
  ) {
    return null
  }
  /** Strictly validated complete retained category values. */
  const categories: SaveCategoriesDomainValue[] = []
  for (const category of record.categories) {
    if (typeof category !== 'object' || category === null || Array.isArray(category)) {
      return null
    }
    /** Raw retained category fields validated without additional properties. */
    const categoryRecord = category as Record<string, unknown>
    if (
      Object.keys(categoryRecord).length !== 4 ||
      typeof categoryRecord.id !== 'string' ||
      typeof categoryRecord.displayName !== 'string' ||
      (categoryRecord.shortDescription !== null &&
        typeof categoryRecord.shortDescription !== 'string') ||
      (categoryRecord.description !== null && typeof categoryRecord.description !== 'string')
    ) {
      return null
    }
    categories.push({
      id: categoryRecord.id,
      displayName: categoryRecord.displayName,
      shortDescription: categoryRecord.shortDescription,
      description: categoryRecord.description
    })
  }
  return {
    workspaceId: record.workspaceId,
    promptCollectionId: record.promptCollectionId,
    categories,
    modifiedAt: record.modifiedAt
  }
}

/** Strict runtime parser for category creation commands. */
export const parseCreateCategoryDomainCommand = (
  value: unknown
): CreateCategoryDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 5 ||
    typeof record.categoryId !== 'string' ||
    typeof record.promptCollectionId !== 'string' ||
    typeof record.displayName !== 'string' ||
    (record.shortDescription !== null && typeof record.shortDescription !== 'string') ||
    (record.description !== null && typeof record.description !== 'string')
  ) {
    return null
  }
  return {
    categoryId: record.categoryId,
    promptCollectionId: record.promptCollectionId,
    displayName: record.displayName,
    shortDescription: record.shortDescription,
    description: record.description
  }
}

/** Renderer-authored command for deleting one collection-owned category. */
export type DeleteCategoryDomainCommand = {
  categoryId: string
  promptCollectionId: string
  workspaceId: string
  modifiedAt: string
}

/** Renderer-authored command for replacing one category's title metadata. */
export type UpdateCategoryDetailsDomainCommand = {
  categoryId: string
  displayName: string
  shortDescription: string | null
}

/** Renderer-authored command for replacing one category description. */
export type SetCategoryDescriptionDomainCommand = {
  categoryId: string
  description: string | null
}

/** Renderer-authored command for reordering one category group. */
export type MoveCategoryDomainCommand = {
  promptCollectionId: string
  statusFolderId: PromptStatusFolderId | null
  categoryId: string
  previousCategoryId: string | null
}

/** Strict runtime parser for renderer-authored category deletion commands. */
export const parseDeleteCategoryDomainCommand = (
  value: unknown
): DeleteCategoryDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 4 ||
    typeof record.categoryId !== 'string' ||
    typeof record.promptCollectionId !== 'string' ||
    typeof record.workspaceId !== 'string' ||
    typeof record.modifiedAt !== 'string'
  ) {
    return null
  }
  return {
    categoryId: record.categoryId,
    promptCollectionId: record.promptCollectionId,
    workspaceId: record.workspaceId,
    modifiedAt: record.modifiedAt
  }
}

/** Strict runtime parser for category-details commands. */
export const parseUpdateCategoryDetailsDomainCommand = (
  value: unknown
): UpdateCategoryDetailsDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.categoryId !== 'string' ||
    typeof record.displayName !== 'string' ||
    (record.shortDescription !== null && typeof record.shortDescription !== 'string')
  ) {
    return null
  }
  return {
    categoryId: record.categoryId,
    displayName: record.displayName,
    shortDescription: record.shortDescription
  }
}

/** Strict runtime parser for category-description replacement commands. */
export const parseSetCategoryDescriptionDomainCommand = (
  value: unknown
): SetCategoryDescriptionDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    typeof record.categoryId !== 'string' ||
    (record.description !== null && typeof record.description !== 'string')
  ) {
    return null
  }
  return { categoryId: record.categoryId, description: record.description }
}

/** Strict runtime parser for category reorder commands. */
export const parseMoveCategoryDomainCommand = (
  value: unknown
): MoveCategoryDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 4 ||
    typeof record.promptCollectionId !== 'string' ||
    (record.statusFolderId !== null && !isPromptStatusFolderId(record.statusFolderId)) ||
    typeof record.categoryId !== 'string' ||
    (record.previousCategoryId !== null && typeof record.previousCategoryId !== 'string')
  ) {
    return null
  }
  return {
    promptCollectionId: record.promptCollectionId,
    statusFolderId: record.statusFolderId,
    categoryId: record.categoryId,
    previousCategoryId: record.previousCategoryId
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

/** Plans category insertion and collection ownership against the supplied domain graph. */
export const planCreateCategoryDomainMutation: DomainPlanner<
  CreateCategoryDomainCommand
> = (state, command) => {
  /** Requested collection that will own the new category group. */
  const promptCollection = state.get('promptCollection', command.promptCollectionId)
  /** Existing entity occupying the requested stable category ID. */
  const existingCategory = state.get('category', command.categoryId)
  /** Normalized category name persisted by both renderer and main projections. */
  const displayName = normalizeCategoryDisplayName(command.displayName)
  /** Normalized optional summary persisted beside the category display name. */
  const shortDescription = normalizeCategoryShortDescription(command.shortDescription)
  /** Optional Markdown description, represented as absent when it contains only whitespace. */
  const description = command.description?.trim() ? command.description : null
  /** Authoritative collection and category targets returned for any conflict. */
  const targets: DomainTarget[] = [
    { entityType: 'promptCollection', id: command.promptCollectionId },
    { entityType: 'category', id: command.categoryId }
  ]
  /** Categories currently owned by the requested collection. */
  const categories = promptCollection
    ? getPromptCollectionCategoryIds(promptCollection).flatMap((categoryId) => {
        /** Loaded category associated with one ordered group. */
        const category = state.get('category', categoryId)
        return category ? [category] : []
      })
    : []

  if (
    !promptCollection ||
    /[\\/]/.test(promptCollection.folderName) ||
    existingCategory ||
    !displayName ||
    hasCategoryDisplayNameConflict(categories, displayName)
  ) {
    return createConflict('Category creation conflict', targets)
  }

  /** New category record inserted with its stable client-generated identity. */
  const category: Category = {
    id: command.categoryId,
    displayName,
    shortDescription,
    description
  }
  return [
    {
      type: 'update',
      entityType: 'promptCollection',
      id: promptCollection.id,
      recipe: (draft) => {
        if (draft.kind === 'template') {
          draft.statusFolders.active.categoryOrder = insertCategoryOrderGroup(draft.statusFolders.active.categoryOrder, category.id)
          return
        }
        for (const layout of Object.values(draft.statusFolders)) {
          if (layout.ordering === 'category') {
            layout.categoryOrder = insertCategoryOrderGroup(
              layout.categoryOrder,
              category.id
            )
          }
        }
      }
    },
    { type: 'insert', entityType: 'category', id: category.id, data: category }
  ]
}

/** Returns every domain target affected by deleting one category. */
const collectCategoryDeletionTargets = (
  state: DomainState,
  categoryId: string,
  owningCollection: PromptCollection | undefined,
  fallbackCollectionId: string
): DomainTarget[] => {
  /** Correct authoritative target set for the deletion attempt. */
  const targets: DomainTarget[] = []
  addUniqueTarget(targets, {
    entityType: 'promptCollection',
    id: owningCollection?.id ?? fallbackCollectionId
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

/** Removes deleted category groups and prepends new groups as one ordered block. */
const applyManagedCategoryOrderChanges = (
  categoryOrder: CategoryOrder,
  deletedCategoryIds: readonly string[],
  newCategoryIds: readonly string[]
): CategoryOrder => {
  /** Ordering after deleted content has moved into Uncategorized. */
  let nextOrder = categoryOrder
  for (const categoryId of deletedCategoryIds) {
    nextOrder = deleteCategoryOrderGroup(nextOrder, categoryId)
  }
  /** Existing categorized groups retained after the new-category block. */
  const retainedGroups = nextOrder.categories.filter(
    (group) => group.categoryId !== null && !newCategoryIds.includes(group.categoryId)
  )
  return {
    categories: [
      nextOrder.categories[0]!,
      ...newCategoryIds.map((categoryId) => ({ categoryId, entries: [] })),
      ...retainedGroups
    ]
  }
}

/** Plans one atomic insert, update, and deletion set for collection-owned categories. */
export const planSaveCategoriesDomainMutation: DomainPlanner<
  SaveCategoriesDomainCommand
> = (state, command) => {
  /** collection whose complete retained category set is being saved. */
  const promptCollection = state.get('promptCollection', command.promptCollectionId)
  /** Workspace required for deleted-category navigation cleanup. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Existing category IDs currently owned by the requested collection. */
  const ownedCategoryIds = promptCollection ? getPromptCollectionCategoryIds(promptCollection) : []
  /** Existing category ID set used to distinguish retained records from new records. */
  const ownedCategoryIdSet = new Set(ownedCategoryIds)
  /** Requested retained category IDs used for completeness and deletion resolution. */
  const retainedCategoryIdSet = new Set(command.categories.map((category) => category.id))
  /** Existing categories omitted from the retained draft list and therefore staged for deletion. */
  const deletedCategoryIds = ownedCategoryIds.filter(
    (categoryId) => !retainedCategoryIdSet.has(categoryId)
  )
  /** Requested IDs absent from the domain graph and therefore staged for insertion. */
  const newCategoryIds = command.categories.flatMap((category) =>
    state.get('category', category.id) ? [] : [category.id]
  )
  /** Unique authoritative targets returned if ownership or draft validation fails. */
  const conflictTargets: DomainTarget[] = [
    { entityType: 'promptCollection', id: command.promptCollectionId },
    { entityType: 'workspace', id: command.workspaceId }
  ]
  for (const categoryId of new Set([...ownedCategoryIds, ...retainedCategoryIdSet])) {
    addUniqueTarget(conflictTargets, { entityType: 'category', id: categoryId })
  }
  for (const categoryId of deletedCategoryIds) {
    for (const target of collectCategoryDeletionTargets(
      state,
      categoryId,
      promptCollection,
      command.promptCollectionId
    )) {
      addUniqueTarget(conflictTargets, target)
    }
  }

  /** Normalized retained values persisted by both renderer and main projections. */
  const normalizedCategories = command.categories.map((category) => ({
    id: category.id,
    displayName: normalizeCategoryDisplayName(category.displayName),
    shortDescription: normalizeCategoryShortDescription(category.shortDescription),
    description: category.description?.trim() ? category.description : null
  }))
  /** Case-insensitive retained names checked for collection-local uniqueness. */
  const normalizedNames = normalizedCategories.map((category) =>
    category.displayName.toLocaleLowerCase()
  )
  /** Whether requested IDs and existing records describe this collection's full retained set. */
  const hasInvalidOwnership = command.categories.some((category) => {
    /** Existing category with the requested stable identity, if any. */
    const existing = state.get('category', category.id)
    return existing !== undefined && !ownedCategoryIdSet.has(category.id)
  })

  if (
    !promptCollection ||
    !workspace ||
    !getAllWorkspaceCollectionEntries(workspace).some(
      (entry) => entry.id === command.promptCollectionId
    ) ||
    /[\\/]/.test(promptCollection.folderName) ||
    retainedCategoryIdSet.size !== command.categories.length ||
    normalizedCategories.some((category) => category.displayName.length === 0) ||
    new Set(normalizedNames).size !== normalizedNames.length ||
    hasInvalidOwnership
  ) {
    return createConflict('Category management conflict', conflictTargets)
  }

  /** Atomic authoritative changes for category metadata, ordering, references, and UI state. */
  const changes: DomainChange[] = []
  if (deletedCategoryIds.length > 0 || newCategoryIds.length > 0) {
    changes.push({
      type: 'update',
      entityType: 'promptCollection',
      id: promptCollection.id,
      recipe: (draft) => {
        if (draft.kind === 'template') {
          draft.statusFolders.active.categoryOrder = applyManagedCategoryOrderChanges(
            draft.statusFolders.active.categoryOrder,
            deletedCategoryIds,
            newCategoryIds
          )
          return
        }
        for (const layout of Object.values(draft.statusFolders)) {
          if (layout.ordering !== 'category') continue
          layout.categoryOrder = applyManagedCategoryOrderChanges(
            layout.categoryOrder,
            deletedCategoryIds,
            newCategoryIds
          )
        }
      }
    })
  }

  for (const category of normalizedCategories) {
    /** Existing retained category checked for a meaningful metadata change. */
    const existing = state.get('category', category.id)
    if (!existing) {
      changes.push({
        type: 'insert',
        entityType: 'category',
        id: category.id,
        data: category
      })
      continue
    }
    if (
      existing.displayName === category.displayName &&
      existing.shortDescription === category.shortDescription &&
      existing.description === category.description
    ) {
      continue
    }
    changes.push({
      type: 'update',
      entityType: 'category',
      id: category.id,
      recipe: (draft) => {
        draft.displayName = category.displayName
        draft.shortDescription = category.shortDescription
        draft.description = category.description
      }
    })
  }

  for (const categoryId of deletedCategoryIds) {
    changes.push({ type: 'delete', entityType: 'category', id: categoryId })
  }
  for (const prompt of state.getAll('prompt')) {
    if (!prompt.category || !deletedCategoryIds.includes(prompt.category)) continue
    changes.push({
      type: 'update',
      entityType: 'prompt',
      id: prompt.id,
      recipe: (draft) => {
        delete draft.category
        draft.modifiedAt = command.modifiedAt
      }
    })
  }
  for (const promptTemplate of state.getAll('promptTemplate')) {
    if (
      !promptTemplate.category ||
      !deletedCategoryIds.includes(promptTemplate.category)
    ) {
      continue
    }
    changes.push({
      type: 'update',
      entityType: 'promptTemplate',
      id: promptTemplate.id,
      recipe: (draft) => {
        delete draft.category
        draft.modifiedAt = command.modifiedAt
      }
    })
  }

  /** Workspace navigation currently pointing at a staged deleted category. */
  const workspaceUiState = state.get('workspaceUiState', command.workspaceId)
  /** Deleted active category whose selected row must transfer to the collection owner. */
  const selectedDeletedCategoryId =
    workspaceUiState &&
    isPromptCollectionScreenSelection(workspaceUiState) &&
    workspaceUiState.selectedScreenData.promptCollectionId === command.promptCollectionId &&
    workspaceUiState.selectedScreenData.contentOwnerId &&
    deletedCategoryIds.includes(workspaceUiState.selectedScreenData.contentOwnerId)
      ? workspaceUiState.selectedScreenData.contentOwnerId
      : null
  if (selectedDeletedCategoryId && workspaceUiState) {
    /** Deleted owner's prior selection used to retain a selected prompt when possible. */
    const deletedUiState = state.get(
      'workspacePromptCollectionUiState',
      createWorkspacePromptCollectionUiStateKey(command.workspaceId, selectedDeletedCategoryId)
    )
    /** Collection owner's prompt-collection view state receiving the transferred selection. */
    const collectionUiStateId = createWorkspacePromptCollectionUiStateKey(
      command.workspaceId,
      command.promptCollectionId
    )
    /** Existing collection state retained except for its selected row. */
    const collectionUiState = state.get('workspacePromptCollectionUiState', collectionUiStateId)
    /** Selected row normalized from category details to the collection header. */
    const selectedEntryId =
      !deletedUiState ||
      deletedUiState.selectedEntryId === 'category-details' ||
      deletedUiState.selectedEntryId === 'collection-header'
        ? 'collection-header'
        : deletedUiState.selectedEntryId
    changes.push({
      type: 'update',
      entityType: 'workspaceUiState',
      id: command.workspaceId,
      recipe: (draft) => {
        if (isPromptCollectionScreenSelection(draft)) {
          draft.selectedScreenData.contentOwnerId = command.promptCollectionId
        }
      }
    })
    if (collectionUiState) {
      changes.push({
        type: 'update',
        entityType: 'workspacePromptCollectionUiState',
        id: collectionUiStateId,
        recipe: (draft) => {
          draft.selectedEntryId = selectedEntryId
        }
      })
    } else {
      /** Default collection view state created when active selection transfers from a category. */
      const nextCollectionUiState: WorkspacePromptCollectionUiState = {
        workspaceId: command.workspaceId,
        contentOwnerId: command.promptCollectionId,
        selectedEntryId,
        treeIsExpanded: true,
        contentSectionIsExpanded: true,
        scrollTopByMode: {},
        selectedMode: PromptStatusFolderId.Active,
        shownFinalStatusGroups: {}
      }
      changes.push({
        type: 'insert',
        entityType: 'workspacePromptCollectionUiState',
        id: collectionUiStateId,
        data: nextCollectionUiState
      })
    }
  }
  for (const categoryId of deletedCategoryIds) {
    changes.push({
      type: 'delete',
      entityType: 'workspacePromptCollectionUiState',
      id: createWorkspacePromptCollectionUiStateKey(command.workspaceId, categoryId)
    })
  }
  return changes
}

/** Plans category deletion and reference cleanup against the supplied domain graph. */
export const planDeleteCategoryDomainMutation: DomainPlanner<
  DeleteCategoryDomainCommand
> = (state, command) => {
  /** Category selected by the renderer-authored command. */
  const category = state.get('category', command.categoryId)
  /** Authoritative collection currently owning the category group. */
  const owningCollection = state
    .getAll('promptCollection')
    .find((collection) =>
      getPromptCollectionCategoryIds(collection).includes(command.categoryId)
    )
  /** Workspace that owns the category's prompt collection. */
  const workspace = state
    .getAll('workspace')
    .find((candidate) =>
      getAllWorkspaceCollectionEntries(candidate).some((entry) => entry.id === owningCollection?.id)
    )
  /** Correct target set used by successful planning and invariant conflicts. */
  const targets = collectCategoryDeletionTargets(
    state,
    command.categoryId,
    owningCollection,
    command.promptCollectionId
  )

  if (
    !category ||
    !owningCollection ||
    owningCollection.id !== command.promptCollectionId ||
    !workspace ||
    workspace.id !== command.workspaceId
  ) {
    return createConflict('Category ownership conflict', targets)
  }

  /** Shared domain changes for ownership, deletion, and reference cleanup. */
  const changes: DomainChange[] = [
    {
      type: 'update',
      entityType: 'promptCollection',
      id: owningCollection.id,
      recipe: (draft) => {
        if (draft.kind === 'template') {
          draft.statusFolders.active.categoryOrder = deleteCategoryOrderGroup(
            draft.statusFolders.active.categoryOrder,
            command.categoryId
          )
          return
        }
        for (const layout of Object.values(draft.statusFolders)) {
          if (layout.ordering === 'category') {
            layout.categoryOrder = deleteCategoryOrderGroup(
              layout.categoryOrder,
              command.categoryId
            )
          }
        }
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

  /** Workspace-level navigation state used to identify an actively selected category. */
  const workspaceUiState = state.get('workspaceUiState', command.workspaceId)
  /** Whether the deleted category currently owns the visible prompt-collection selection. */
  const isActiveCategory =
    workspaceUiState &&
    isPromptCollectionScreenSelection(workspaceUiState) &&
    workspaceUiState.selectedScreenData.promptCollectionId === command.promptCollectionId &&
    workspaceUiState.selectedScreenData.contentOwnerId === command.categoryId
  /** Composite key for the deleted category's prompt-collection view state. */
  const categoryUiStateId = createWorkspacePromptCollectionUiStateKey(
    command.workspaceId,
    command.categoryId
  )
  /** Persisted row selection last owned by the deleted category. */
  const categoryUiState = state.get('workspacePromptCollectionUiState', categoryUiStateId)

  if (isActiveCategory && workspaceUiState) {
    /** Collection owner state receiving the transferred selected prompt or template. */
    const collectionUiStateId = createWorkspacePromptCollectionUiStateKey(
      command.workspaceId,
      command.promptCollectionId
    )
    /** Existing collection expansion state preserved while its selection changes. */
    const collectionUiState = state.get('workspacePromptCollectionUiState', collectionUiStateId)
    /** Selected entry normalized from category-only details to the collection header. */
    const selectedEntryId =
      !categoryUiState ||
      categoryUiState.selectedEntryId === 'category-details' ||
      categoryUiState.selectedEntryId === 'collection-header'
        ? 'collection-header'
        : categoryUiState.selectedEntryId
    changes.push({
      type: 'update',
      entityType: 'workspaceUiState',
      id: command.workspaceId,
      recipe: (draft) => {
        if (isPromptCollectionScreenSelection(draft)) {
          draft.selectedScreenData.contentOwnerId = command.promptCollectionId
        }
      }
    })
    if (collectionUiState) {
      changes.push({
        type: 'update',
        entityType: 'workspacePromptCollectionUiState',
        id: collectionUiStateId,
        recipe: (draft) => {
          draft.selectedEntryId = selectedEntryId
        }
      })
    } else {
      /** Default collection state created only when an active category selection must transfer. */
      const nextCollectionUiState: WorkspacePromptCollectionUiState = {
        workspaceId: command.workspaceId,
        contentOwnerId: command.promptCollectionId,
        selectedEntryId,
        treeIsExpanded: true,
        contentSectionIsExpanded: true,
        scrollTopByMode: {},
        selectedMode: PromptStatusFolderId.Active,
        shownFinalStatusGroups: {}
      }
      changes.push({
        type: 'insert',
        entityType: 'workspacePromptCollectionUiState',
        id: collectionUiStateId,
        data: nextCollectionUiState
      })
    }
  }

  changes.push({
    type: 'delete',
    entityType: 'workspacePromptCollectionUiState',
    id: categoryUiStateId
  })
  return changes
}

/** Plans a collision-free category title and short-description update. */
export const planUpdateCategoryDetailsDomainMutation: DomainPlanner<
  UpdateCategoryDetailsDomainCommand
> = (state, command) => {
  /** Category selected by the details command. */
  const category = state.get('category', command.categoryId)
  /** collection currently owning the selected category. */
  const owningCollection = state
    .getAll('promptCollection')
    .find((collection) => getPromptCollectionCategoryIds(collection).includes(command.categoryId))
  /** Stable target returned for any details conflict. */
  const targets: DomainTarget[] = [{ entityType: 'category', id: command.categoryId }]
  /** Normalized display name shared by renderer and main projections. */
  const displayName = normalizeCategoryDisplayName(command.displayName)
  /** Normalized optional summary stored atomically with the display name. */
  const shortDescription = normalizeCategoryShortDescription(command.shortDescription)
  /** Loaded sibling categories participating in name-conflict validation. */
  const siblings = owningCollection
    ? getPromptCollectionCategoryIds(owningCollection).flatMap((categoryId) => {
        /** Loaded category referenced by one sibling group. */
        const sibling = state.get('category', categoryId)
        return sibling ? [sibling] : []
      })
    : []

  if (
    !category ||
    !owningCollection ||
    !displayName ||
    hasCategoryDisplayNameConflict(siblings, displayName, command.categoryId)
  ) {
    return createConflict('Category details conflict', targets)
  }

  return [
    {
      type: 'update',
      entityType: 'category',
      id: command.categoryId,
      recipe: (draft) => {
        draft.displayName = displayName
        draft.shortDescription = shortDescription
      }
    }
  ]
}

/** Plans one category-description replacement as a single paced target update. */
export const planSetCategoryDescriptionDomainMutation: DomainPlanner<
  SetCategoryDescriptionDomainCommand
> = (state, command) => {
  /** Category selected by the description command. */
  const category = state.get('category', command.categoryId)
  /** Stable target returned when the category is unavailable. */
  const targets: DomainTarget[] = [{ entityType: 'category', id: command.categoryId }]
  if (!category) return createConflict('Category description conflict', targets)

  return [
    {
      type: 'update',
      entityType: 'category',
      id: command.categoryId,
      recipe: (draft) => {
        draft.description = command.description
      }
    }
  ]
}

/** Plans one category-group reorder inside its owning collection. */
export const planMoveCategoryDomainMutation: DomainPlanner<MoveCategoryDomainCommand> = (
  state,
  command
) => {
  /** collection whose category order is changing. */
  const promptCollection = state.get('promptCollection', command.promptCollectionId)
  /** Stable collection target returned for ordering conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'promptCollection', id: command.promptCollectionId }
  ]
  if (!promptCollection) return createConflict('Category move conflict', targets)

  /** Category order selected by the template collection or prompt status-folder identity. */
  const currentCategoryOrder =
    promptCollection.kind === 'template'
      ? command.statusFolderId === null
        ? promptCollection.statusFolders.active.categoryOrder
        : null
      : command.statusFolderId === null
        ? null
        : (() => {
            /** Prompt status-folder layout selected for category movement. */
            const layout = promptCollection.statusFolders[command.statusFolderId]
            return layout.ordering === 'category' ? layout.categoryOrder : null
          })()
  if (!currentCategoryOrder) return createConflict('Category move conflict', targets)

  try {
    /** Validated category order projected before constructing the shared recipe. */
    const categoryOrder = moveCategoryOrderGroup(
      currentCategoryOrder,
      command.categoryId,
      command.previousCategoryId
    )
    return [
      {
        type: 'update',
        entityType: 'promptCollection',
        id: command.promptCollectionId,
        recipe: (draft) => {
          if (draft.kind === 'template') {
            draft.statusFolders.active.categoryOrder = categoryOrder
          } else if (command.statusFolderId !== null) {
            /** Ordered draft layout selected by the validated command identity. */
            const layout = draft.statusFolders[command.statusFolderId]
            if (layout.ordering === 'category') layout.categoryOrder = categoryOrder
          }
        }
      }
    ]
  } catch {
    return createConflict('Category move conflict', targets)
  }
}
