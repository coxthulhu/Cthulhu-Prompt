import type {
  TanstackMutationRequest,
  TanstackMutationWireRequest
} from './TanstackSystemSettingsRevision'

export type TanstackCreateWorkspacePayload = {
  workspacePath: string
  includeExamplePrompts: boolean
}

export type TanstackCreateWorkspaceRequest = TanstackMutationRequest<TanstackCreateWorkspacePayload>

export type TanstackCreateWorkspaceWireRequest =
  TanstackMutationWireRequest<TanstackCreateWorkspaceRequest>

export type TanstackCreateWorkspaceResponse =
  | { requestId: string; success: true }
  | { requestId: string; success: false; error: string }
