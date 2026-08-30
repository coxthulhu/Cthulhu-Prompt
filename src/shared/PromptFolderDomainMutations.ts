import type { DomainPlanner, DomainTarget } from './DomainChanges'
import {
  hasPromptFolderNameConflict,
  preparePromptFolderName
} from './promptFolderName'

/** Renderer-authored command for renaming one root prompt or template folder. */
export type RenamePromptFolderDomainCommand = {
  promptFolderId: string
  displayName: string
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
