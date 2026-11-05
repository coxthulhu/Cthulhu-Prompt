import { parseSaveProjectsCommand, planSaveProjects } from '@shared/domain/workspace/ProjectDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers the complete project-list save through the shared atomic mutation framework. */
export const setupProjectMutationHandlers = (): void => {
  handleMainDomainMutation({ ipc: { channel: 'save-projects' }, mutation: { parseCommand: parseSaveProjectsCommand, plan: planSaveProjects } })
}
