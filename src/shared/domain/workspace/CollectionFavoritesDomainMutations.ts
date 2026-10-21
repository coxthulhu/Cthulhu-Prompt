import type { DomainPlanner } from '../DomainChanges'
import { getWorkspaceCollectionEntries } from './Workspace'
import type { MovePromptCollectionDomainCommand } from '../prompt-collection/PromptCollectionDomainMutations'

/** Explicit favorite state avoids toggling against a stale renderer snapshot. */
export type SetCollectionFavoriteCommand = {
  /** Workspace owning the private preference. */
  workspaceId: string
  /** Collection whose membership changes. */
  promptCollectionId: string
  /** Whether the collection belongs in Favorites. */
  favorite: boolean
}

/** Validates favorite intent at the IPC boundary. */
export const parseSetCollectionFavoriteCommand = (value: unknown): SetCollectionFavoriteCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Command fields accepted by both mutation planners. */
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 3 || typeof record.workspaceId !== 'string' ||
    typeof record.promptCollectionId !== 'string' || typeof record.favorite !== 'boolean') return null
  return record as SetCollectionFavoriteCommand
}

/** Appends newly favorited collections and preserves all other favorite positions. */
export const planSetCollectionFavorite: DomainPlanner<SetCollectionFavoriteCommand> = (state, command) => {
  /** Workspace whose user-specific favorites will change. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Collection kind selects the independent favorite order. */
  const collection = state.get('promptCollection', command.promptCollectionId)
  if (!workspace || !collection || !getWorkspaceCollectionEntries(workspace, collection.kind)
    .some((entry) => entry.id === collection.id)) {
    return { status: 'conflict', reason: 'Collection favorite ownership conflict', targets: [{ entityType: 'workspace', id: command.workspaceId }] }
  }
  return [{
    type: 'update', entityType: 'workspace', id: workspace.id,
    recipe: (draft) => {
      /** Existing favorites are kept in their own order. */
      const ids = draft.favoriteCollectionIds[collection.kind]
      if (command.favorite) {
        if (!ids.includes(collection.id)) ids.push(collection.id)
      } else {
        draft.favoriteCollectionIds[collection.kind] = ids.filter((id) => id !== collection.id)
      }
    }
  }]
}

/** Moves a favorite without changing the complete collection order. */
export const planMoveCollectionFavorite: DomainPlanner<MovePromptCollectionDomainCommand> = (state, command) => {
  /** Workspace owning the independently ordered favorites. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Collection kind determines which favorite order can be changed. */
  const collection = state.get('promptCollection', command.promptCollectionId)
  /** Remaining favorites provide the insertion position after removing the moved entry. */
  const ids = workspace && collection
    ? workspace.favoriteCollectionIds[collection.kind].filter((id) => id !== collection.id) : []
  /** A null predecessor places the favorite first. */
  const index = command.previousEntryId === null ? 0 : ids.indexOf(command.previousEntryId) + 1
  if (!workspace || !collection || !workspace.favoriteCollectionIds[collection.kind].includes(collection.id) ||
    (command.previousEntryId !== null && index === 0)) {
    return { status: 'conflict', reason: 'Collection favorite reorder conflict', targets: [{ entityType: 'workspace', id: command.workspaceId }] }
  }
  ids.splice(index, 0, collection.id)
  return [{
    type: 'update', entityType: 'workspace', id: workspace.id,
    recipe: (draft) => { draft.favoriteCollectionIds[collection.kind] = ids }
  }]
}
