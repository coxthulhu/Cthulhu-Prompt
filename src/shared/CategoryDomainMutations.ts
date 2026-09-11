import type {
  DomainChange,
  DomainMutationConflict,
  DomainPlanner,
  DomainState,
  DomainTarget
} from './DomainChanges'
import {
  hasCategoryDisplayNameConflict,
  normalizeCategoryDisplayName,
  normalizeCategoryShortDescription,
  type Category
} from './Category'
import {
  deleteCategoryOrderGroup,
  getPromptFolderCategoryIds,
  insertCategoryOrderGroup,
  moveCategoryOrderGroup,
  type CategoryOrder,
  type PromptFolder
} from './PromptFolder'
import { isPromptStatusFolderId, PromptStatusFolderId } from './Prompt'
import {
  createWorkspacePromptFolderUiStateKey,
  type WorkspacePromptFolderUiState
} from './UiState'
import { isPromptFolderScreenSelection } from './UserPersistence'
import { getAllWorkspaceFolderEntries } from './Workspace'

/** Renderer-authored command for creating one root-owned category. */
export type CreateCategoryDomainCommand = {
  categoryId: string
  promptFolderId: string
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

/** Renderer-authored command for atomically saving one root folder's category drafts. */
export type SaveCategoriesDomainCommand = {
  workspaceId: string
  promptFolderId: string
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
    typeof record.promptFolderId !== 'string' ||
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
    promptFolderId: record.promptFolderId,
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
    typeof record.promptFolderId !== 'string' ||
    typeof record.displayName !== 'string' ||
    (record.shortDescription !== null && typeof record.shortDescription !== 'string') ||
    (record.description !== null && typeof record.description !== 'string')
  ) {
    return null
  }
  return {
    categoryId: record.categoryId,
    promptFolderId: record.promptFolderId,
    displayName: record.displayName,
    shortDescription: record.shortDescription,
    description: record.description
  }
}

/** Renderer-authored command for deleting one root-owned category. */
export type DeleteCategoryDomainCommand = {
  categoryId: string
  promptFolderId: string
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
  promptFolderId: string
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
    typeof record.promptFolderId !== 'string' ||
    typeof record.workspaceId !== 'string' ||
    typeof record.modifiedAt !== 'string'
  ) {
    return null
  }
  return {
    categoryId: record.categoryId,
    promptFolderId: record.promptFolderId,
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
    typeof record.promptFolderId !== 'string' ||
    (record.statusFolderId !== null && !isPromptStatusFolderId(record.statusFolderId)) ||
    typeof record.categoryId !== 'string' ||
    (record.previousCategoryId !== null && typeof record.previousCategoryId !== 'string')
  ) {
    return null
  }
  return {
    promptFolderId: record.promptFolderId,
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

/** Plans category insertion and root ownership against the supplied domain graph. */
export const planCreateCategoryDomainMutation: DomainPlanner<
  CreateCategoryDomainCommand
> = (state, command) => {
  /** Requested root folder that will own the new category group. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Existing entity occupying the requested stable category ID. */
  const existingCategory = state.get('category', command.categoryId)
  /** Normalized category name persisted by both renderer and main projections. */
  const displayName = normalizeCategoryDisplayName(command.displayName)
  /** Normalized optional summary persisted beside the category display name. */
  const shortDescription = normalizeCategoryShortDescription(command.shortDescription)
  /** Optional Markdown description, represented as absent when it contains only whitespace. */
  const description = command.description?.trim() ? command.description : null
  /** Authoritative folder and category targets returned for any conflict. */
  const targets: DomainTarget[] = [
    { entityType: 'promptFolder', id: command.promptFolderId },
    { entityType: 'category', id: command.categoryId }
  ]
  /** Categories currently owned by the requested root folder. */
  const categories = promptFolder
    ? getPromptFolderCategoryIds(promptFolder).flatMap((categoryId) => {
        /** Loaded category associated with one ordered group. */
        const category = state.get('category', categoryId)
        return category ? [category] : []
      })
    : []

  if (
    !promptFolder ||
    /[\\/]/.test(promptFolder.folderName) ||
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
      entityType: 'promptFolder',
      id: promptFolder.id,
      recipe: (draft) => {
        if (draft.kind === 'template') {
          draft.categoryOrder = insertCategoryOrderGroup(draft.categoryOrder, category.id)
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

/** Plans one atomic insert, update, and deletion set for root-owned categories. */
export const planSaveCategoriesDomainMutation: DomainPlanner<
  SaveCategoriesDomainCommand
> = (state, command) => {
  /** Root folder whose complete retained category set is being saved. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Workspace required for deleted-category navigation cleanup. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Existing category IDs currently owned by the requested root folder. */
  const ownedCategoryIds = promptFolder ? getPromptFolderCategoryIds(promptFolder) : []
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
    { entityType: 'promptFolder', id: command.promptFolderId },
    { entityType: 'workspace', id: command.workspaceId }
  ]
  for (const categoryId of new Set([...ownedCategoryIds, ...retainedCategoryIdSet])) {
    addUniqueTarget(conflictTargets, { entityType: 'category', id: categoryId })
  }
  for (const categoryId of deletedCategoryIds) {
    for (const target of collectCategoryDeletionTargets(
      state,
      categoryId,
      promptFolder,
      command.promptFolderId
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
  /** Case-insensitive retained names checked for root-local uniqueness. */
  const normalizedNames = normalizedCategories.map((category) =>
    category.displayName.toLocaleLowerCase()
  )
  /** Whether requested IDs and existing records describe this root's full retained set. */
  const hasInvalidOwnership = command.categories.some((category) => {
    /** Existing category with the requested stable identity, if any. */
    const existing = state.get('category', category.id)
    return existing !== undefined && !ownedCategoryIdSet.has(category.id)
  })

  if (
    !promptFolder ||
    !workspace ||
    !getAllWorkspaceFolderEntries(workspace).some(
      (entry) => entry.id === command.promptFolderId
    ) ||
    /[\\/]/.test(promptFolder.folderName) ||
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
      entityType: 'promptFolder',
      id: promptFolder.id,
      recipe: (draft) => {
        if (draft.kind === 'template') {
          draft.categoryOrder = applyManagedCategoryOrderChanges(
            draft.categoryOrder,
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
  /** Deleted active category whose selected row must transfer to the root owner. */
  const selectedDeletedCategoryId =
    workspaceUiState &&
    isPromptFolderScreenSelection(workspaceUiState) &&
    workspaceUiState.selectedScreenData.promptFolderId === command.promptFolderId &&
    workspaceUiState.selectedScreenData.contentOwnerId &&
    deletedCategoryIds.includes(workspaceUiState.selectedScreenData.contentOwnerId)
      ? workspaceUiState.selectedScreenData.contentOwnerId
      : null
  if (selectedDeletedCategoryId && workspaceUiState) {
    /** Deleted owner's prior selection used to retain a selected prompt when possible. */
    const deletedUiState = state.get(
      'workspacePromptFolderUiState',
      createWorkspacePromptFolderUiStateKey(command.workspaceId, selectedDeletedCategoryId)
    )
    /** Root owner's prompt-folder view state receiving the transferred selection. */
    const rootUiStateId = createWorkspacePromptFolderUiStateKey(
      command.workspaceId,
      command.promptFolderId
    )
    /** Existing root state retained except for its selected row. */
    const rootUiState = state.get('workspacePromptFolderUiState', rootUiStateId)
    /** Selected row normalized from category details to the root header. */
    const selectedEntryId =
      !deletedUiState ||
      deletedUiState.selectedEntryId === 'category-details' ||
      deletedUiState.selectedEntryId === 'root-header'
        ? 'root-header'
        : deletedUiState.selectedEntryId
    changes.push({
      type: 'update',
      entityType: 'workspaceUiState',
      id: command.workspaceId,
      recipe: (draft) => {
        if (isPromptFolderScreenSelection(draft)) {
          draft.selectedScreenData.contentOwnerId = command.promptFolderId
        }
      }
    })
    if (rootUiState) {
      changes.push({
        type: 'update',
        entityType: 'workspacePromptFolderUiState',
        id: rootUiStateId,
        recipe: (draft) => {
          draft.selectedEntryId = selectedEntryId
        }
      })
    } else {
      /** Default root view state created when active selection transfers from a category. */
      const nextRootUiState: WorkspacePromptFolderUiState = {
        workspaceId: command.workspaceId,
        contentOwnerId: command.promptFolderId,
        selectedEntryId,
        treeIsExpanded: true,
        contentSectionIsExpanded: true
      }
      changes.push({
        type: 'insert',
        entityType: 'workspacePromptFolderUiState',
        id: rootUiStateId,
        data: nextRootUiState
      })
    }
  }
  for (const categoryId of deletedCategoryIds) {
    changes.push({
      type: 'delete',
      entityType: 'workspacePromptFolderUiState',
      id: createWorkspacePromptFolderUiStateKey(command.workspaceId, categoryId)
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
  /** Authoritative root currently owning the category group. */
  const owningFolder = state
    .getAll('promptFolder')
    .find((folder) =>
      getPromptFolderCategoryIds(folder).includes(command.categoryId)
    )
  /** Workspace that owns the category's root prompt folder. */
  const workspace = state
    .getAll('workspace')
    .find((candidate) =>
      getAllWorkspaceFolderEntries(candidate).some((entry) => entry.id === owningFolder?.id)
    )
  /** Correct target set used by successful planning and invariant conflicts. */
  const targets = collectCategoryDeletionTargets(
    state,
    command.categoryId,
    owningFolder,
    command.promptFolderId
  )

  if (
    !category ||
    !owningFolder ||
    owningFolder.id !== command.promptFolderId ||
    !workspace ||
    workspace.id !== command.workspaceId
  ) {
    return createConflict('Category ownership conflict', targets)
  }

  /** Shared domain changes for ownership, deletion, and reference cleanup. */
  const changes: DomainChange[] = [
    {
      type: 'update',
      entityType: 'promptFolder',
      id: owningFolder.id,
      recipe: (draft) => {
        if (draft.kind === 'template') {
          draft.categoryOrder = deleteCategoryOrderGroup(
            draft.categoryOrder,
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
  /** Whether the deleted category currently owns the visible prompt-folder selection. */
  const isActiveCategory =
    workspaceUiState &&
    isPromptFolderScreenSelection(workspaceUiState) &&
    workspaceUiState.selectedScreenData.promptFolderId === command.promptFolderId &&
    workspaceUiState.selectedScreenData.contentOwnerId === command.categoryId
  /** Composite key for the deleted category's prompt-folder view state. */
  const categoryUiStateId = createWorkspacePromptFolderUiStateKey(
    command.workspaceId,
    command.categoryId
  )
  /** Persisted row selection last owned by the deleted category. */
  const categoryUiState = state.get('workspacePromptFolderUiState', categoryUiStateId)

  if (isActiveCategory && workspaceUiState) {
    /** Root owner state receiving the transferred selected prompt or template. */
    const rootUiStateId = createWorkspacePromptFolderUiStateKey(
      command.workspaceId,
      command.promptFolderId
    )
    /** Existing root expansion state preserved while its selection changes. */
    const rootUiState = state.get('workspacePromptFolderUiState', rootUiStateId)
    /** Selected entry normalized from category-only details to the root header. */
    const selectedEntryId =
      !categoryUiState ||
      categoryUiState.selectedEntryId === 'category-details' ||
      categoryUiState.selectedEntryId === 'root-header'
        ? 'root-header'
        : categoryUiState.selectedEntryId
    changes.push({
      type: 'update',
      entityType: 'workspaceUiState',
      id: command.workspaceId,
      recipe: (draft) => {
        if (isPromptFolderScreenSelection(draft)) {
          draft.selectedScreenData.contentOwnerId = command.promptFolderId
        }
      }
    })
    if (rootUiState) {
      changes.push({
        type: 'update',
        entityType: 'workspacePromptFolderUiState',
        id: rootUiStateId,
        recipe: (draft) => {
          draft.selectedEntryId = selectedEntryId
        }
      })
    } else {
      /** Default root state created only when an active category selection must transfer. */
      const nextRootUiState: WorkspacePromptFolderUiState = {
        workspaceId: command.workspaceId,
        contentOwnerId: command.promptFolderId,
        selectedEntryId,
        treeIsExpanded: true,
        contentSectionIsExpanded: true
      }
      changes.push({
        type: 'insert',
        entityType: 'workspacePromptFolderUiState',
        id: rootUiStateId,
        data: nextRootUiState
      })
    }
  }

  changes.push({
    type: 'delete',
    entityType: 'workspacePromptFolderUiState',
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
  /** Root folder currently owning the selected category. */
  const owningFolder = state
    .getAll('promptFolder')
    .find((folder) => getPromptFolderCategoryIds(folder).includes(command.categoryId))
  /** Stable target returned for any details conflict. */
  const targets: DomainTarget[] = [{ entityType: 'category', id: command.categoryId }]
  /** Normalized display name shared by renderer and main projections. */
  const displayName = normalizeCategoryDisplayName(command.displayName)
  /** Normalized optional summary stored atomically with the display name. */
  const shortDescription = normalizeCategoryShortDescription(command.shortDescription)
  /** Loaded sibling categories participating in name-conflict validation. */
  const siblings = owningFolder
    ? getPromptFolderCategoryIds(owningFolder).flatMap((categoryId) => {
        /** Loaded category referenced by one sibling group. */
        const sibling = state.get('category', categoryId)
        return sibling ? [sibling] : []
      })
    : []

  if (
    !category ||
    !owningFolder ||
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

/** Plans one category-group reorder inside its owning root folder. */
export const planMoveCategoryDomainMutation: DomainPlanner<MoveCategoryDomainCommand> = (
  state,
  command
) => {
  /** Root folder whose category order is changing. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Stable folder target returned for ordering conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'promptFolder', id: command.promptFolderId }
  ]
  if (!promptFolder) return createConflict('Category move conflict', targets)

  /** Category order selected by the template root or prompt status-folder identity. */
  const currentCategoryOrder =
    promptFolder.kind === 'template'
      ? command.statusFolderId === null
        ? promptFolder.categoryOrder
        : null
      : command.statusFolderId === null
        ? null
        : (() => {
            /** Prompt status-folder layout selected for category movement. */
            const layout = promptFolder.statusFolders[command.statusFolderId]
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
        entityType: 'promptFolder',
        id: command.promptFolderId,
        recipe: (draft) => {
          if (draft.kind === 'template') {
            draft.categoryOrder = categoryOrder
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
