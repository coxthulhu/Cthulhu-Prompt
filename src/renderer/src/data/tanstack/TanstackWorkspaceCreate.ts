import type {
  TanstackCreateWorkspacePayload,
  TanstackCreateWorkspaceResponse
} from '@shared/tanstack/TanstackWorkspaceCreate'
import { tanstackIpcInvokeWithPayload } from './TanstackIpcInvoke'

export const createTanstackWorkspace = async (
  workspacePath: string,
  includeExamplePrompts: boolean
): Promise<TanstackCreateWorkspaceResponse> => {
  // Special-case payload: tanstack-create-workspace expects command arguments,
  // not a normal TanStack revision mutation payload object.
  return await tanstackIpcInvokeWithPayload<
    TanstackCreateWorkspaceResponse,
    TanstackCreateWorkspacePayload
  >('tanstack-create-workspace', {
    workspacePath,
    includeExamplePrompts
  })
}
