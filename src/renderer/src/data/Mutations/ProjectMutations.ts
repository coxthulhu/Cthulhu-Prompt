import { compactGuid } from '@shared/utilities/compactGuid'
import { getProjectInfo, type ProjectInfo } from '@shared/domain/workspace/Project'
import { planSaveProjects, type SaveProjectsCommand } from '@shared/domain/workspace/ProjectDomainMutations'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'
import { flushAllAutosaves } from '@renderer/data/UiState/autosave/AutosaveFlushes.svelte.ts'

/** Saves the complete ordered draft list, then opens navigateToProjectId when supplied; callers allocate stable draft IDs. */
export const saveProjects = async (workspaceId: string, projects: ProjectInfo[]): Promise<void> => {
  await flushAllAutosaves()
  /** Current ownership determines which drafts require empty starter collections. */
  const workspace = workspaceCollection.get(workspaceId)
  if (!workspace) throw new Error('Workspace not loaded')
  /** Stable starter identities and public metadata are the only draft data sent to main. */
  const command: SaveProjectsCommand = { workspaceId, projects: projects.map((project) => ({
    project: getProjectInfo(project),
    starterCollections: workspace.projects.some((existing) => existing.id === project.id) ? null : {
      promptCollectionId: compactGuid(crypto.randomUUID()), templateCollectionId: compactGuid(crypto.randomUUID()),
      routineCollectionId: compactGuid(crypto.randomUUID())
    }
  })) }
  await runImmediateRendererDomainMutation({ mutation: { command, plan: planSaveProjects }, ipc: { channel: 'save-projects' }, renderer: {
    mutate: ({ collections }) => {
      for (const { starterCollections } of command.projects) {
        if (!starterCollections) continue
        for (const id of [starterCollections.promptCollectionId, starterCollections.templateCollectionId]) {
          collections.promptCollectionClientState.insert({ id, hasLoadedInitialData: false })
        }
      }
    }
  } })
}

/** Moves one project right after another, or first when previousProjectId is null, keeping the others' order. */
export const moveProject = async (workspaceId: string, projectId: string, previousProjectId: string | null): Promise<void> => {
  /** Saved projects in their current order. */
  const projects = workspaceCollection.get(workspaceId)!.projects
  /** Every other project, with the moved one inserted after its new predecessor below. */
  const nextProjects = projects.filter((project) => project.id !== projectId)
  nextProjects.splice(
    nextProjects.findIndex((project) => project.id === previousProjectId) + 1,
    0,
    projects.find((project) => project.id === projectId)!
  )
  await saveProjects(workspaceId, nextProjects)
}
