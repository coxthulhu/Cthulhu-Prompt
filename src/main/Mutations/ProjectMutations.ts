import { parseCreateProjectCommand, parseDeleteProjectCommand, parseMoveProjectCommand, parseUpdateProjectCommand, planCreateProject, planDeleteProject, planMoveProject, planUpdateProject } from '@shared/domain/workspace/ProjectDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers validated project lifecycle commands through the shared atomic mutation framework. */
export const setupProjectMutationHandlers = (): void => {
  handleMainDomainMutation({ ipc: { channel: 'create-project' }, mutation: { parseCommand: parseCreateProjectCommand, plan: planCreateProject } })
  handleMainDomainMutation({ ipc: { channel: 'update-project' }, mutation: { parseCommand: parseUpdateProjectCommand, plan: planUpdateProject } })
  handleMainDomainMutation({ ipc: { channel: 'move-project' }, mutation: { parseCommand: parseMoveProjectCommand, plan: planMoveProject } })
  handleMainDomainMutation({ ipc: { channel: 'delete-project' }, mutation: { parseCommand: parseDeleteProjectCommand, plan: planDeleteProject } })
}
