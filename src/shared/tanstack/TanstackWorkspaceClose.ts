export type TanstackCloseWorkspaceWireRequest = {
  requestId: string
}

export type TanstackCloseWorkspaceResult =
  | { success: true }
  | { success: false; error: string }
