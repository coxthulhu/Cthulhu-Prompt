import type {
  TanstackCreateWorkspacePayload,
  TanstackCreateWorkspaceResponse
} from '@shared/tanstack/TanstackWorkspaceCreate'
import { tanstackIpcInvokeWithPayload } from './TanstackIpcInvoke'

export const createTanstackWorkspace = async (
  workspacePath: string,
  includeExamplePrompts: boolean
): Promise<TanstackCreateWorkspaceResponse> => {
  return await tanstackIpcInvokeWithPayload<
    TanstackCreateWorkspaceResponse,
    TanstackCreateWorkspacePayload
  >('tanstack-create-workspace', {
    workspacePath,
    includeExamplePrompts
  })
}
