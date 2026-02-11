import type {
  MutationRequest,
  MutationWireRequest
} from './SystemSettingsRevision'

// Special-case  create payload. This is command data for workspace setup,
// not a normal revision mutation object with entity revisions.
export type CreateWorkspacePayload = {
  workspacePath: string
  includeExamplePrompts: boolean
}

export type CreateWorkspaceWireRequest =
  MutationWireRequest<MutationRequest<CreateWorkspacePayload>>

export type CreateWorkspaceResponse =
  | { requestId: string; success: true }
  | { requestId: string; success: false; error: string }
