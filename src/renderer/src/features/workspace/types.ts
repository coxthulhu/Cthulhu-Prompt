export type WorkspaceSelectionFailureReason = 'workspace-missing' | 'unknown-error'

export type WorkspaceSelectionResult =
  | { success: true }
  | { success: false; reason: WorkspaceSelectionFailureReason; message?: string }

export type WorkspaceCreationFailureReason = 'creation-failed' | 'unknown-error'

export type WorkspaceCreationResult =
  | { success: true }
  | { success: false; reason: WorkspaceCreationFailureReason; message?: string }
