import { compactGuid } from '@shared/utilities/compactGuid'
import type { ProjectInfo } from '@shared/domain/workspace/Project'
import { planCreateProject, planDeleteProject, planMoveProject, planUpdateProject } from '@shared/domain/workspace/ProjectDomainMutations'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'
import { flushAllAutosaves } from '@renderer/data/UiState/autosave/AutosaveFlushes.svelte.ts'
import { projectNavigation } from '@renderer/features/projects/projectNavigation.svelte.ts'

/** Creates both blank starter collections and opens the new project after persistence succeeds. */
export const createProject = async (workspaceId: string, info: Omit<ProjectInfo, 'id'>): Promise<string> => {
  /** Stable identity used by both processes and returned to future management UI. */
  const id = compactGuid(crypto.randomUUID())
  /** Starter identities are generated once outside the deterministic planner. */
  const command = { workspaceId, project: { ...info, id }, promptCollectionId: compactGuid(crypto.randomUUID()), templateCollectionId: compactGuid(crypto.randomUUID()) }
  await runImmediateRendererDomainMutation({ mutation: { command, plan: planCreateProject }, ipc: { channel: 'create-project' }, renderer: {
    mutate: ({ collections }) => {
      for (const collectionId of [command.promptCollectionId, command.templateCollectionId]) {
        collections.promptCollectionClientState.insert({ id: collectionId, hasLoadedInitialData: false })
      }
    }
  } })
  projectNavigation.request({ workspaceId, projectId: id })
  return id
}

/** Saves complete shared metadata, flushing editors before a possible directory rename. */
export const updateProject = async (workspaceId: string, project: ProjectInfo): Promise<void> => {
  await flushAllAutosaves()
  await runImmediateRendererDomainMutation({ mutation: { command: { workspaceId, project }, plan: planUpdateProject }, ipc: { channel: 'update-project' }, renderer: {} })
}

/** Persists the user's project order independently of every project's collection order. */
export const moveProject = async (workspaceId: string, projectId: string, previousProjectId: string | null): Promise<void> => {
  await runImmediateRendererDomainMutation({ mutation: { command: { workspaceId, projectId, previousProjectId }, plan: planMoveProject }, ipc: { channel: 'move-project' }, renderer: {} })
}

/** Flushes pending edits, removes the complete project, and returns to Home after success. */
export const deleteProject = async (workspaceId: string, projectId: string): Promise<void> => {
  await flushAllAutosaves()
  await runImmediateRendererDomainMutation({ mutation: { command: { workspaceId, projectId }, plan: planDeleteProject }, ipc: { channel: 'delete-project' }, renderer: {} })
  projectNavigation.request({ workspaceId, projectId: null })
}
