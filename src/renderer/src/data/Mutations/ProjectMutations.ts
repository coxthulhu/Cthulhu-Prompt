import { compactGuid } from '@shared/utilities/compactGuid'
import { getProjectInfo, type ProjectInfo } from '@shared/domain/workspace/Project'
import { planSaveProjects, type SaveProjectsCommand } from '@shared/domain/workspace/ProjectDomainMutations'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'
import { flushAllAutosaves } from '@renderer/data/UiState/autosave/AutosaveFlushes.svelte.ts'
import { projectNavigation } from '@renderer/features/projects/projectNavigation.svelte.ts'

/** Saves the complete ordered draft list; callers allocate stable project IDs when adding drafts. */
export const saveProjects = async (workspaceId: string, projects: ProjectInfo[]): Promise<void> => {
  await flushAllAutosaves()
  /** Current ownership determines which drafts require empty starter collections. */
  const workspace = workspaceCollection.get(workspaceId)
  if (!workspace) throw new Error('Workspace not loaded')
  /** Navigation changes only when the currently selected project is removed. */
  const navigation = workspaceUiStateCollection.get(workspaceId)
  /** Capture the selected deletion before the optimistic graph is changed. */
  const deletesSelectedProject = navigation?.selectedScreen === 'project' &&
    !projects.some((project) => project.id === navigation.selectedScreenData.projectId)
  /** Stable starter identities and public metadata are the only draft data sent to main. */
  const command: SaveProjectsCommand = { workspaceId, projects: projects.map((project) => ({
    project: getProjectInfo(project),
    starterCollections: workspace.projects.some((existing) => existing.id === project.id) ? null : {
      promptCollectionId: compactGuid(crypto.randomUUID()), templateCollectionId: compactGuid(crypto.randomUUID())
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
  if (deletesSelectedProject) projectNavigation.request({ workspaceId, projectId: null })
}
