import type {
  DomainChange,
  DomainPlanner,
  DomainTarget
} from './DomainChanges'
import { folderEntryRef, removeEntry, resolveEntryInsertIndex } from './OrderContainer'
import {
  createEmptyPromptFolderSettings,
  createRootCategoryOrder,
  getCategoryOrderCategoryIds,
  type PromptFolder,
  type PromptFolderKind
} from './PromptFolder'
import {
  hasPromptFolderNameConflict,
  preparePromptFolderName
} from './promptFolderName'
import { getMarkdownContentIds } from './MarkdownContent'
import { createMarkdownContentUiStateKey } from './MarkdownContentUiState'
import {
  createCategoryDescriptionEditorUiStateKey,
  createWorkspacePromptFolderUiStateKey
} from './UiState'

/** Renderer-authored command for creating one root prompt or template folder. */
export type CreatePromptFolderDomainCommand = {
  workspaceId: string
  promptFolderId: string
  displayName: string
  previousEntryId: string | null
  kind: PromptFolderKind
}

/** Renderer-authored command for renaming one root prompt or template folder. */
export type RenamePromptFolderDomainCommand = {
  promptFolderId: string
  displayName: string
}

/** Renderer-authored command for reordering one root folder. */
export type MovePromptFolderDomainCommand = {
  workspaceId: string
  promptFolderId: string
  previousEntryId: string | null
}

/** Renderer-authored command for deleting one root folder and its owned graph. */
export type DeletePromptFolderDomainCommand = {
  workspaceId: string
  promptFolderId: string
}

/** Strict runtime parser for root-folder deletion commands. */
export const parseDeletePromptFolderDomainCommand = (
  value: unknown
): DeletePromptFolderDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.promptFolderId !== 'string'
  ) {
    return null
  }
  return record as DeletePromptFolderDomainCommand
}

/** Strict runtime parser for root-folder creation commands. */
export const parseCreatePromptFolderDomainCommand = (
  value: unknown
): CreatePromptFolderDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 5 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.promptFolderId !== 'string' ||
    typeof record.displayName !== 'string' ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string') ||
    (record.kind !== 'prompt' && record.kind !== 'template')
  ) {
    return null
  }
  return {
    workspaceId: record.workspaceId,
    promptFolderId: record.promptFolderId,
    displayName: record.displayName,
    previousEntryId: record.previousEntryId,
    kind: record.kind
  }
}

/** Strict runtime parser for root-folder rename commands. */
export const parseRenamePromptFolderDomainCommand = (
  value: unknown
): RenamePromptFolderDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 2 ||
    typeof record.promptFolderId !== 'string' ||
    typeof record.displayName !== 'string'
  ) {
    return null
  }
  return {
    promptFolderId: record.promptFolderId,
    displayName: record.displayName
  }
}

/** Strict runtime parser for root-folder reorder commands. */
export const parseMovePromptFolderDomainCommand = (
  value: unknown
): MovePromptFolderDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.promptFolderId !== 'string' ||
    (record.previousEntryId !== null && typeof record.previousEntryId !== 'string')
  ) {
    return null
  }
  return {
    workspaceId: record.workspaceId,
    promptFolderId: record.promptFolderId,
    previousEntryId: record.previousEntryId
  }
}

/** Plans root-folder creation and exact workspace placement. */
export const planCreatePromptFolderDomainMutation: DomainPlanner<
  CreatePromptFolderDomainCommand
> = (state, command) => {
  /** Workspace that will own the new root folder. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Existing entity occupying the requested stable folder ID. */
  const existingPromptFolder = state.get('promptFolder', command.promptFolderId)
  /** Authoritative targets returned for creation conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'workspace', id: command.workspaceId },
    { entityType: 'promptFolder', id: command.promptFolderId }
  ]
  /** Validated and normalized root-folder names. */
  const preparedName = preparePromptFolderName(command.displayName)
  /** Same-kind sibling folders participating in name-conflict validation. */
  const siblings = workspace
    ? workspace.entries.flatMap((entry) => {
        /** Loaded sibling referenced by one workspace entry. */
        const sibling = state.get('promptFolder', entry.id)
        return sibling && sibling.kind === command.kind ? [sibling] : []
      })
    : []
  /** Requested insertion index after validating its predecessor. */
  const insertIndex = workspace
    ? resolveEntryInsertIndex(workspace.entries, command.previousEntryId)
    : null

  if (
    !workspace ||
    existingPromptFolder ||
    !preparedName.validation.isValid ||
    hasPromptFolderNameConflict(siblings, preparedName.folderName) ||
    insertIndex === null
  ) {
    return { status: 'conflict', reason: 'Prompt folder creation conflict', targets }
  }

  /** Initial root-folder entity inserted by both renderer and main projections. */
  const promptFolder: PromptFolder = {
    id: command.promptFolderId,
    kind: command.kind,
    folderName: preparedName.folderName,
    displayName: preparedName.displayName,
    completedPromptIds: [],
    categoryOrder: createRootCategoryOrder(),
    settings: createEmptyPromptFolderSettings()
  } as PromptFolder
  return [
    {
      type: 'update',
      entityType: 'workspace',
      id: command.workspaceId,
      recipe: (draft) => {
        /** Workspace entries receiving the new root at its exact position. */
        const entries = [...draft.entries]
        entries.splice(insertIndex, 0, folderEntryRef(command.promptFolderId))
        draft.entries = entries
      }
    },
    {
      type: 'insert',
      entityType: 'promptFolder',
      id: command.promptFolderId,
      data: promptFolder
    }
  ]
}

/** Plans one root-folder display-name and physical-directory rename. */
export const planRenamePromptFolderDomainMutation: DomainPlanner<
  RenamePromptFolderDomainCommand
> = (state, command) => {
  /** Root folder selected for the rename. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Stable target returned when the rename cannot be planned. */
  const targets: DomainTarget[] = [
    { entityType: 'promptFolder', id: command.promptFolderId }
  ]
  if (!promptFolder) {
    return { status: 'conflict', reason: 'Prompt folder rename conflict', targets }
  }

  /** Workspace that owns the selected root folder. */
  const workspace = state
    .getAll('workspace')
    .find((candidate) => candidate.entries.some((entry) => entry.id === promptFolder.id))
  /** Validated and normalized display and directory names. */
  const preparedName = preparePromptFolderName(command.displayName)
  /** Same-kind sibling folders participating in name-conflict validation. */
  const siblingFolders = workspace
    ? workspace.entries.flatMap((entry) => {
        /** Loaded root folder referenced by one workspace entry. */
        const candidate = state.get('promptFolder', entry.id)
        return candidate && candidate.kind === promptFolder.kind ? [candidate] : []
      })
    : []

  if (
    !workspace ||
    !preparedName.validation.isValid ||
    hasPromptFolderNameConflict(siblingFolders, preparedName.folderName, promptFolder.id)
  ) {
    return { status: 'conflict', reason: 'Prompt folder rename conflict', targets }
  }

  return [
    {
      type: 'update',
      entityType: 'promptFolder',
      id: promptFolder.id,
      recipe: (draft) => {
        draft.displayName = preparedName.displayName
        draft.folderName = preparedName.folderName
      }
    }
  ]
}

/** Plans root-folder deletion and every filesystem or SQLite record it owns. */
export const planDeletePromptFolderDomainMutation: DomainPlanner<DeletePromptFolderDomainCommand> = (
  state,
  command
) => {
  /** Workspace expected to own the deleted root folder. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Root folder whose complete graph will be removed. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Required workspace and root targets returned for ownership conflicts. */
  const targets: DomainTarget[] = [
    { entityType: 'workspace', id: command.workspaceId },
    { entityType: 'promptFolder', id: command.promptFolderId }
  ]
  if (
    !workspace ||
    !promptFolder ||
    !workspace.entries.some((entry) => entry.id === command.promptFolderId)
  ) {
    return {
      status: 'conflict',
      reason: 'Prompt folder deletion conflict',
      targets
    }
  }
  /** Prompt or template IDs owned by the deleted root folder. */
  const contentIds = getMarkdownContentIds(promptFolder, promptFolder.kind)
  /** Category IDs owned by the deleted root folder. */
  const categoryIds = getCategoryOrderCategoryIds(promptFolder.categoryOrder)
  /** Complete domain changes applied atomically in meaningful ownership order. */
  const changes: DomainChange[] = [
    {
      type: 'update',
      entityType: 'workspace',
      id: command.workspaceId,
      recipe: (draft) => {
        draft.entries = removeEntry(draft.entries, 'folder', command.promptFolderId)
      }
    },
    ...contentIds.map(
      (contentId): DomainChange => ({
        type: 'delete',
        entityType: promptFolder.kind === 'prompt' ? 'prompt' : 'promptTemplate',
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
      entityType: 'promptFolder',
      id: command.promptFolderId
    }
  ]
  for (const contentId of contentIds) {
    changes.push({
      type: 'delete',
      entityType: 'markdownContentUiState',
      id: createMarkdownContentUiStateKey(command.workspaceId, contentId)
    })
  }
  for (const contentOwnerId of [command.promptFolderId, ...categoryIds]) {
    changes.push({
      type: 'delete',
      entityType: 'workspacePromptFolderUiState',
      id: createWorkspacePromptFolderUiStateKey(command.workspaceId, contentOwnerId)
    })
  }
  for (const categoryId of categoryIds) {
    changes.push({
      type: 'delete',
      entityType: 'categoryDescriptionEditorUiState',
      id: createCategoryDescriptionEditorUiStateKey(command.workspaceId, categoryId)
    })
  }
  /** Existing workspace screen state adjusted when it references the deleted root. */
  const workspaceUiState = state.get('workspaceUiState', command.workspaceId)
  if (workspaceUiState) {
    changes.push({
      type: 'update',
      entityType: 'workspaceUiState',
      id: command.workspaceId,
      recipe: (draft) => {
        if (
          draft.selectedScreen === 'prompt-folders' &&
          draft.selectedScreenData.promptFolderId === command.promptFolderId
        ) {
          Object.assign(draft, {
            selectedScreen: 'home',
            selectedScreenData: null,
            lastPromptFolderId: null
          })
        } else if (draft.lastPromptFolderId === command.promptFolderId) {
          draft.lastPromptFolderId = null
        }
      }
    })
  }
  return changes
}

/** Plans one root-folder reorder within its owning workspace. */
export const planMovePromptFolderDomainMutation: DomainPlanner<
  MovePromptFolderDomainCommand
> = (state, command) => {
  /** Workspace whose root-folder order is changing. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Root folder being repositioned. */
  const promptFolder = state.get('promptFolder', command.promptFolderId)
  /** Stable workspace target returned for ordering conflicts. */
  const targets: DomainTarget[] = [{ entityType: 'workspace', id: command.workspaceId }]
  /** Workspace entries after removing the moved root. */
  const entries = workspace
    ? removeEntry(workspace.entries, 'folder', command.promptFolderId)
    : []
  /** Requested reinsertion index after predecessor validation. */
  const insertIndex = resolveEntryInsertIndex(entries, command.previousEntryId)

  if (
    !workspace ||
    !promptFolder ||
    !workspace.entries.some((entry) => entry.id === command.promptFolderId) ||
    insertIndex === null
  ) {
    return { status: 'conflict', reason: 'Prompt folder move conflict', targets }
  }

  entries.splice(insertIndex, 0, folderEntryRef(command.promptFolderId))
  return [
    {
      type: 'update',
      entityType: 'workspace',
      id: command.workspaceId,
      recipe: (draft) => {
        draft.entries = entries
      }
    }
  ]
}
