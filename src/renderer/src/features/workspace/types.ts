export type WorkspaceSelectionResult = { success: true } | { success: false; message: string }

export type WorkspaceCreationResult =
  | { success: true }
  | { success: false; message: string }
