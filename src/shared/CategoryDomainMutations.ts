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
  type Category
} from './Category'
import {
  deleteCategoryOrderGroup,
  getCategoryOrderCategoryIds,
  insertCategoryOrderGroup,
  moveCategoryOrderGroup,
  type PromptFolder
} from './PromptFolder'
import {
  createCategoryDescriptionEditorUiStateKey,
  createWorkspacePromptFolderUiStateKey,
  type WorkspacePromptFolderUiState
} from './UiState'

/** Renderer-authored command for creating one root-owned category. */
export type CreateCategoryDomainCommand = {
  categoryId: string
  promptFolderId: string
  displayName: string
}

/** Strict runtime parser for category creation commands. */
export const parseCreateCategoryDomainCommand = (
  value: unknown
): CreateCategoryDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.categoryId !== 'string' ||
    typeof record.promptFolderId !== 'string' ||
    typeof record.displayName !== 'string'
  ) {
    return null
  }
  return {
    categoryId: record.categoryId,
    promptFolderId: record.promptFolderId,
    displayName: record.displayName
  }
}

/** Renderer-authored command for deleting one root-owned category. */
export type DeleteCategoryDomainCommand = {
  categoryId: string
  promptFolderId: string
  workspaceId: string
  modifiedAt: string
}

/** Renderer-authored command for renaming one root-owned category. */
export type RenameCategoryDomainCommand = {
  categoryId: string
  displayName: string
}

/** Renderer-authored command for replacing one category description. */
export type SetCategoryDescriptionDomainCommand = {
  categoryId: string
  description: string | null
}

/** Renderer-authored command for reordering one category group. */
export type MoveCategoryDomainCommand = {
  promptFolderId: string
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

/** Strict runtime parser for category rename commands. */
export const parseRenameCategoryDomainCommand = (
  value: unknown
): RenameCategoryDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    typeof record.categoryId !== 'string' ||
    typeof record.displayName !== 'string'
  ) {
    return null
  }
  return { categoryId: record.categoryId, displayName: record.displayName }
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
    Object.keys(record).length !== 3 ||
    typeof record.promptFolderId !== 'string' ||
    typeof record.categoryId !== 'string' ||
    (record.previousCategoryId !== null && typeof record.previousCategoryId !== 'string')
  ) {
    return null
  }
  return {
    promptFolderId: record.promptFolderId,
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
  /** Authoritative folder and category targets returned for any conflict. */
  const targets: DomainTarget[] = [
    { entityType: 'promptFolder', id: command.promptFolderId },
    { entityType: 'category', id: command.categoryId }
  ]
  /** Categories currently owned by the requested root folder. */
  const categories = promptFolder
    ? getCategoryOrderCategoryIds(promptFolder.categoryOrder).flatMap((categoryId) => {
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
  const category: Category = { id: command.categoryId, displayName, description: null }
  return [
    {
      type: 'update',
      entityType: 'promptFolder',
      id: promptFolder.id,
      recipe: (draft) => {
        draft.categoryOrder = insertCategoryOrderGroup(draft.categoryOrder, category.id)
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
  /** Workspace that owns the category's root prompt folder. */
  const workspace = state
    .getAll('workspace')
    .find((candidate) => candidate.entries.some((entry) => entry.id === owningFolder?.id))
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

  /** Workspace-level navigation state used to identify an actively selected category. */
  const workspaceUiState = state.get('workspaceUiState', command.workspaceId)
  /** Whether the deleted category currently owns the visible prompt-folder selection. */
  const isActiveCategory =
    workspaceUiState?.selectedScreen === 'prompt-folders' &&
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
        if (draft.selectedScreen === 'prompt-folders') {
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
        detailsSectionIsExpanded: false,
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
  changes.push({
    type: 'delete',
    entityType: 'categoryDescriptionEditorUiState',
    id: createCategoryDescriptionEditorUiStateKey(command.workspaceId, command.categoryId)
  })

  return changes
}

/** Plans a collision-free category display-name and filename update. */
export const planRenameCategoryDomainMutation: DomainPlanner<
  RenameCategoryDomainCommand
> = (state, command) => {
  /** Category selected by the rename command. */
  const category = state.get('category', command.categoryId)
  /** Root folder currently owning the selected category. */
  const owningFolder = state
    .getAll('promptFolder')
    .find((folder) => getCategoryOrderCategoryIds(folder.categoryOrder).includes(command.categoryId))
  /** Stable target returned for any rename conflict. */
  const targets: DomainTarget[] = [{ entityType: 'category', id: command.categoryId }]
  /** Normalized display name shared by renderer and main projections. */
  const displayName = normalizeCategoryDisplayName(command.displayName)
  /** Loaded sibling categories participating in name-conflict validation. */
  const siblings = owningFolder
    ? getCategoryOrderCategoryIds(owningFolder.categoryOrder).flatMap((categoryId) => {
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
    return createConflict('Category rename conflict', targets)
  }

  return [
    {
      type: 'update',
      entityType: 'category',
      id: command.categoryId,
      recipe: (draft) => {
        draft.displayName = displayName
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

  try {
    /** Validated category order projected before constructing the shared recipe. */
    const categoryOrder = moveCategoryOrderGroup(
      promptFolder.categoryOrder,
      command.categoryId,
      command.previousCategoryId
    )
    return [
      {
        type: 'update',
        entityType: 'promptFolder',
        id: command.promptFolderId,
        recipe: (draft) => {
          draft.categoryOrder = categoryOrder
        }
      }
    ]
  } catch {
    return createConflict('Category move conflict', targets)
  }
}
