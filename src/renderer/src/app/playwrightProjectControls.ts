import { saveProjects } from '@renderer/data/Mutations/ProjectMutations'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { getSelectedWorkspaceId } from './workspaceSelection.svelte.ts'

/** Exercises project commands Project Settings cannot issue, such as reordering and invalid batches. */
export const playwrightProjectControls = {
  saveProjects,
  /** Reads the authoritative renderer workspace for stable project IDs and rollback comparisons. */
  getWorkspace: () => workspaceCollection.get(getSelectedWorkspaceId()!)
}
