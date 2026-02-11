export type CloseWorkspaceWireRequest = {
  requestId: string
}

export type CloseWorkspaceResult =
  | { requestId: string; success: true }
  | { requestId: string; success: false; error: string }
