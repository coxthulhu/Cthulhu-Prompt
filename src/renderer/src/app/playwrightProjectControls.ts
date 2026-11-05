import * as projects from '@renderer/data/Mutations/ProjectMutations'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { getSelectedWorkspaceId } from './workspaceSelection.svelte.ts'
import { createPromptCollection } from '@renderer/data/Mutations/PromptCollectionMutations'
import { setCollectionFavorite, movePromptCollection } from '@renderer/data/Mutations/WorkspaceMutations'

/** Exercises production project commands until management UI exists; remove these controls when that UI lands. */
export const playwrightProjectControls = {
  ...projects, createCollection: createPromptCollection, setCollectionFavorite, moveCollection: movePromptCollection,
  /** Reads the authoritative renderer workspace for stable project IDs and collection membership. */
  getWorkspace: () => workspaceCollection.get(getSelectedWorkspaceId()!),
  /** Reads navigation to verify that deletion removes the project's remembered selection. */
  getNavigation: () => workspaceUiStateCollection.get(getSelectedWorkspaceId()!)
}
