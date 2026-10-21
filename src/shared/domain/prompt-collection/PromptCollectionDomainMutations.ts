import { getCollectionNoteIds } from '@shared/domain/note/Note'
import { deleteAttachedNoteUiState } from '@shared/domain/ui-state/AttachedNoteUiState'
import type {
  DomainChange,
  DomainPlanner,
  DomainTarget
} from '@shared/domain/DomainChanges'
import { collectionEntryRef, removeEntry, resolveEntryInsertIndex } from '@shared/domain/OrderContainer'
import {
  createEmptyPromptCollectionSettings,
  createPromptStatusFolderLayouts,
  getPromptCollectionCategoryIds,
  type PromptCollection,
  type PromptCollectionKind
} from '@shared/domain/prompt-collection/PromptCollection'
import {
  hasPromptCollectionNameConflict,
  preparePromptCollectionName
} from '@shared/domain/prompt-collection/promptCollectionName'
import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import { createMarkdownContentUiStateKey } from '@shared/domain/ui-state/MarkdownContentUiState'
import { createWorkspacePromptCollectionUiStateKey } from '@shared/domain/ui-state/UiState'
import {
  getAllWorkspaceCollectionEntries,
  getWorkspaceCollectionEntries,
  setWorkspaceCollectionEntries
} from '@shared/domain/workspace/Workspace'

/** Renderer-authored command for creating one collection prompt or template collection. */
export type CreatePromptCollectionDomainCommand = {
  workspaceId: string
  promptCollectionId: string
  displayName: string
  previousEntryId: string | null
  kind: PromptCollectionKind
}

/** Renderer-authored command for renaming one collection prompt or template collection. */
export type RenamePromptCollectionDomainCommand = {
  promptCollectionId: string
  displayName: string
}

/** Renderer-authored command for reordering one collection. */
export type MovePromptCollectionDomainCommand = {
  workspaceId: string
  promptCollectionId: string
  previousEntryId: string | null
}

/** Renderer-authored command for deleting one collection and its owned graph. */
export type DeletePromptCollectionDomainCommand = {
  workspaceId: string
  promptCollectionId: string
}

/** Strict runtime parser for collection deletion commands. */
export const parseDeletePromptCollectionDomainCommand = (
  value: unknown
): DeletePromptCollectionDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.promptCollectionId !== 'string'
  ) {
    return null
  }
  return record as DeletePromptCollectionDomainCommand
}

/** Strict runtime parser for collection creation commands. */
export const parseCreatePromptCollectionDomainCommand = (
  value: unknown
): CreatePromptCollectionDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 5 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.promptCollectionId !== 'string' ||
    typeof record.displayName !== 'string' ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string') ||
    (record.kind !== 'prompt' && record.kind !== 'template')
  ) {
    return null
  }
  return {
    workspaceId: record.workspaceId,
    promptCollectionId: record.promptCollectionId,
    displayName: record.displayName,
    previousEntryId: record.previousEntryId,
    kind: record.kind
  }
}

/** Strict runtime parser for collection rename commands. */
export const parseRenamePromptCollectionDomainCommand = (
  value: unknown
): RenamePromptCollectionDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    typeof record.promptCollectionId !== 'string' ||
    typeof record.displayName !== 'string'
  ) {
    return null
  }
  return {
    promptCollectionId: record.promptCollectionId,
    displayName: record.displayName
  }
}

/** Strict runtime parser for collection reorder commands. */
export const parseMovePromptCollectionDomainCommand = (
  value: unknown
): MovePromptCollectionDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.promptCollectionId !== 'string' ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string')
  ) {
    return null
  }
  return {
    workspaceId: record.workspaceId,
    promptCollectionId: record.promptCollectionId,
    previousEntryId: record.previousEntryId
  }
}

/** Plans collection creation and exact workspace placement. */
export const planCreatePromptCollectionDomainMutation: DomainPlanner<
  CreatePromptCollectionDomainCommand
> = (state, command) => {
  /** Workspace that will own the new collection. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Existing entity occupying the requested stable collection ID. */
  const existingPromptCollection = state.get('promptCollection', command.promptCollectionId)
  /** Authoritative targets returned for creation conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'workspace', id: command.workspaceId },
    { entityType: 'promptCollection', id: command.promptCollectionId }
  ]
  /** Validated and normalized collection names. */
  const preparedName = preparePromptCollectionName(command.displayName)
  /** Same-kind sibling collections participating in name-conflict validation. */
  const siblings = workspace
    ? getAllWorkspaceCollectionEntries(workspace).flatMap((entry) => {
        /** Loaded sibling referenced by one workspace entry. */
        const sibling = state.get('promptCollection', entry.id)
        return sibling && sibling.kind === command.kind ? [sibling] : []
      })
    : []
  /** Requested insertion index after validating its predecessor. */
  const insertIndex = workspace
    ? resolveEntryInsertIndex(getWorkspaceCollectionEntries(workspace, command.kind), command.previousEntryId)
    : null

  if (
    !workspace ||
    existingPromptCollection ||
    !preparedName.validation.isValid ||
    hasPromptCollectionNameConflict(siblings, preparedName.folderName) ||
    insertIndex === null
  ) {
    return { status: 'conflict', reason: 'Prompt collection creation conflict', targets }
  }

  /** Initial collection entity inserted by both renderer and main projections. */
  const promptCollection: PromptCollection =
    command.kind === 'prompt'
      ? {
          id: command.promptCollectionId,
          kind: 'prompt',
          folderName: preparedName.folderName,
          displayName: preparedName.displayName,
          statusFolders: createPromptStatusFolderLayouts(),
          settings: createEmptyPromptCollectionSettings()
        }
      : {
          id: command.promptCollectionId,
          kind: 'template',
          folderName: preparedName.folderName,
          displayName: preparedName.displayName,
          statusFolders: createPromptStatusFolderLayouts(),
          settings: createEmptyPromptCollectionSettings()
        }
  return [
    {
      type: 'update',
      entityType: 'workspace',
      id: command.workspaceId,
      recipe: (draft) => {
        /** Workspace entries receiving the new collection at its exact position. */
        /** Kind-specific order receiving the new collection at its exact position. */
        const entries = [...getWorkspaceCollectionEntries(draft, command.kind)]
        entries.splice(insertIndex, 0, collectionEntryRef(command.promptCollectionId))
        setWorkspaceCollectionEntries(draft, command.kind, entries)
      }
    },
    {
      type: 'insert',
      entityType: 'promptCollection',
      id: command.promptCollectionId,
      data: promptCollection
    }
  ]
}

/** Plans one collection display-name and physical-directory rename. */
export const planRenamePromptCollectionDomainMutation: DomainPlanner<
  RenamePromptCollectionDomainCommand
> = (state, command) => {
  /** collection selected for the rename. */
  const promptCollection = state.get('promptCollection', command.promptCollectionId)
  /** Stable target returned when the rename cannot be planned. */
  const targets: DomainTarget[] = [
    { entityType: 'promptCollection', id: command.promptCollectionId }
  ]
  if (!promptCollection) {
    return { status: 'conflict', reason: 'Prompt collection rename conflict', targets }
  }

  /** Workspace that owns the selected collection. */
  const workspace = state
    .getAll('workspace')
    .find((candidate) =>
      getAllWorkspaceCollectionEntries(candidate).some((entry) => entry.id === promptCollection.id)
    )
  /** Validated and normalized display and directory names. */
  const preparedName = preparePromptCollectionName(command.displayName)
  /** Same-kind sibling collections participating in name-conflict validation. */
  const siblingCollections = workspace
    ? getAllWorkspaceCollectionEntries(workspace).flatMap((entry) => {
        /** Loaded collection referenced by one workspace entry. */
        const candidate = state.get('promptCollection', entry.id)
        return candidate && candidate.kind === promptCollection.kind ? [candidate] : []
      })
    : []

  if (
    !workspace ||
    !preparedName.validation.isValid ||
    hasPromptCollectionNameConflict(siblingCollections, preparedName.folderName, promptCollection.id)
  ) {
    return { status: 'conflict', reason: 'Prompt collection rename conflict', targets }
  }

  return [
    {
      type: 'update',
      entityType: 'promptCollection',
      id: promptCollection.id,
      recipe: (draft) => {
        draft.displayName = preparedName.displayName
        draft.folderName = preparedName.folderName
      }
    }
  ]
}

/** Plans collection deletion and every filesystem or SQLite record it owns. */
export const planDeletePromptCollectionDomainMutation: DomainPlanner<DeletePromptCollectionDomainCommand> = (
  state,
  command
) => {
  /** Workspace expected to own the deleted collection. */
  const workspace = state.get('workspace', command.workspaceId)
  /** collection whose complete graph will be removed. */
  const promptCollection = state.get('promptCollection', command.promptCollectionId)
  /** Required workspace and collection targets returned for ownership conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'workspace', id: command.workspaceId },
    { entityType: 'promptCollection', id: command.promptCollectionId }
  ]
  if (
    !workspace ||
    !promptCollection ||
    !getWorkspaceCollectionEntries(workspace, promptCollection.kind).some(
      (entry) => entry.id === command.promptCollectionId
    )
  ) {
    return {
      status: 'conflict',
      reason: 'Prompt collection deletion conflict',
      targets
    }
  }
  /** Prompt or template IDs owned by the deleted collection. */
  const contentIds = getMarkdownContentIds(promptCollection, promptCollection.kind)
  /** Category IDs owned by the deleted collection. */
  const categoryIds = getPromptCollectionCategoryIds(promptCollection)
  /** First collection remaining in workspace order after the requested deletion. */
  const nextPromptCollectionId =
    getWorkspaceCollectionEntries(workspace, promptCollection.kind).find(
      (entry) => entry.id !== command.promptCollectionId
    )?.id ?? null
  /** Complete domain changes applied atomically in meaningful ownership order. */
  const changes: DomainChange[] = [
    {
      type: 'update',
      entityType: 'workspace',
      id: command.workspaceId,
      recipe: (draft) => {
        setWorkspaceCollectionEntries(
          draft,
          promptCollection.kind,
          removeEntry(
            getWorkspaceCollectionEntries(draft, promptCollection.kind),
            'collection',
            command.promptCollectionId
          )
        )
        draft.favoriteCollectionIds[promptCollection.kind] = draft.favoriteCollectionIds[promptCollection.kind]
          .filter((id) => id !== command.promptCollectionId)
      }
    },
    ...getCollectionNoteIds(state, promptCollection).flatMap((id): DomainChange[] => [
      { type: 'delete', entityType: 'note', id },
      ...(state.get('note', id)?.kind === 'attached' ? [deleteAttachedNoteUiState(command.workspaceId, id)] : [])
    ]),
    ...contentIds.map(
      (contentId): DomainChange => ({
        type: 'delete',
        entityType: promptCollection.kind === 'prompt' ? 'prompt' : 'promptTemplate',
        id: contentId
      }) as DomainChange
    ),
    ...categoryIds.map(
      (categoryId): DomainChange => ({
        type: 'delete',
        entityType: 'category',
        id: categoryId
      })
    ),
    {
      type: 'delete',
      entityType: 'promptCollection',
      id: command.promptCollectionId
    }
  ]
  for (const contentId of contentIds) {
    changes.push({
      type: 'delete',
      entityType: 'markdownContentUiState',
      id: createMarkdownContentUiStateKey(command.workspaceId, contentId)
    })
  }
  for (const contentOwnerId of [command.promptCollectionId, ...categoryIds]) {
    changes.push({
      type: 'delete',
      entityType: 'workspacePromptCollectionUiState',
      id: createWorkspacePromptCollectionUiStateKey(command.workspaceId, contentOwnerId)
    })
  }
  /** Existing workspace screen state adjusted when it references the deleted collection. */
  const workspaceUiState = state.get('workspaceUiState', command.workspaceId)
  if (workspaceUiState) {
    changes.push({
      type: 'update',
      entityType: 'workspaceUiState',
      id: command.workspaceId,
      recipe: (draft) => {
        if (
          (draft.selectedScreen === 'prompt-task-collections' ||
            draft.selectedScreen === 'prompt-template-collections') &&
          draft.selectedScreenData.promptCollectionId === command.promptCollectionId
        ) {
          Object.assign(draft, {
            selectedScreen:
              promptCollection.kind === 'template'
                ? 'prompt-template-collections'
                : 'prompt-task-collections',
            selectedScreenData: {
              promptCollectionId: nextPromptCollectionId,
              contentOwnerId: nextPromptCollectionId
            },
            ...(promptCollection.kind === 'template'
              ? { lastPromptTemplateCollectionId: nextPromptCollectionId }
              : { lastPromptTaskCollectionId: nextPromptCollectionId })
          })
        } else if (
          promptCollection.kind === 'template' &&
          draft.lastPromptTemplateCollectionId === command.promptCollectionId
        ) {
          draft.lastPromptTemplateCollectionId = nextPromptCollectionId
        } else if (
          promptCollection.kind === 'prompt' &&
          draft.lastPromptTaskCollectionId === command.promptCollectionId
        ) {
          draft.lastPromptTaskCollectionId = nextPromptCollectionId
        }
      }
    })
  }
  return changes
}

/** Plans one collection reorder within its owning workspace. */
export const planMovePromptCollectionDomainMutation: DomainPlanner<
  MovePromptCollectionDomainCommand
> = (state, command) => {
  /** Workspace whose collection order is changing. */
  const workspace = state.get('workspace', command.workspaceId)
  /** collection being repositioned. */
  const promptCollection = state.get('promptCollection', command.promptCollectionId)
  /** Stable workspace target returned for ordering conflicts. */
  const targets: DomainTarget[] = [{ entityType: 'workspace', id: command.workspaceId }]
  /** Workspace entries after removing the moved collection. */
  const entries = workspace && promptCollection
    ? removeEntry(
        getWorkspaceCollectionEntries(workspace, promptCollection.kind),
        'collection',
        command.promptCollectionId
      )
    : []
  /** Requested reinsertion index after predecessor validation. */
  const insertIndex = resolveEntryInsertIndex(entries, command.previousEntryId)

  if (
    !workspace ||
    !promptCollection ||
    !getWorkspaceCollectionEntries(workspace, promptCollection.kind).some(
      (entry) => entry.id === command.promptCollectionId
    ) ||
    insertIndex === null
  ) {
    return { status: 'conflict', reason: 'Prompt collection move conflict', targets }
  }

  entries.splice(insertIndex, 0, collectionEntryRef(command.promptCollectionId))
  return [
    {
      type: 'update',
      entityType: 'workspace',
      id: command.workspaceId,
      recipe: (draft) => {
        setWorkspaceCollectionEntries(draft, promptCollection.kind, entries)
      }
    }
  ]
}
