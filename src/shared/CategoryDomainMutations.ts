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
  type PromptFolder
} from './PromptFolder'

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
