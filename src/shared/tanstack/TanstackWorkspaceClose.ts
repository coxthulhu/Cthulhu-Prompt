export type TanstackCloseWorkspaceWireRequest = {
  requestId: string
}

export type TanstackCloseWorkspaceResult =
  | { requestId: string; success: true }
  | { requestId: string; success: false; error: string }
