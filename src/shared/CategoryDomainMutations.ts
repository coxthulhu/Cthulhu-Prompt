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
  type PromptFolder
} from './PromptFolder'

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
  modifiedAt: string
}

/** Strict runtime parser for renderer-authored category deletion commands. */
export const parseDeleteCategoryDomainCommand = (
  value: unknown
): DeleteCategoryDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.categoryId !== 'string' ||
    typeof record.promptFolderId !== 'string' ||
    typeof record.modifiedAt !== 'string'
  ) {
    return null
  }
  return {
    categoryId: record.categoryId,
    promptFolderId: record.promptFolderId,
    modifiedAt: record.modifiedAt
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
