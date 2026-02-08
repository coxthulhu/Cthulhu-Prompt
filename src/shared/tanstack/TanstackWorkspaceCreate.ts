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

// This reuses the TanStack mutation request envelope shape ({ payload, requestId })
// for IPC correlation only.
export type TanstackCreateWorkspaceRequest = TanstackMutationRequest<TanstackCreateWorkspacePayload>

export type TanstackCreateWorkspaceWireRequest =
  TanstackMutationWireRequest<TanstackCreateWorkspaceRequest>

export type TanstackCreateWorkspaceResponse =
  | { requestId: string; success: true }
  | { requestId: string; success: false; error: string }
