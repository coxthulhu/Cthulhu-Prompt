import type {
  TanstackMutationRequest,
  TanstackMutationWireRequest
} from './TanstackSystemSettingsRevision'

// Special-case TanStack create payload. This is command data for workspace setup,
// not a normal revision mutation object with entity revisions.
export type TanstackCreateWorkspacePayload = {
  workspacePath: string
  includeExamplePrompts: boolean
}

export type TanstackCreateWorkspaceWireRequest =
  TanstackMutationWireRequest<TanstackMutationRequest<TanstackCreateWorkspacePayload>>

export type TanstackCreateWorkspaceResponse =
  | { requestId: string; success: true }
  | { requestId: string; success: false; error: string }
