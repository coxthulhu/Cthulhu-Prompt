export type WorkspaceSelectionResult =
  | { success: true }
  | { success: false; reason: 'workspace-missing' | 'unknown-error'; message?: string }

export type WorkspaceCreationResult =
  | { success: true }
  | { success: false; reason: 'creation-failed' | 'unknown-error'; message?: string }
