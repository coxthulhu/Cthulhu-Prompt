import { setupUpdatedPromptHandlers } from './prompt'
import { setupUpdatedPromptFolderHandlers } from './promptFolder'
import { setupUpdatedSystemSettingsHandlers } from './systemSettings'
import { setupUpdatedWorkspaceHandlers } from './workspace'

// Entry point for the updated refetch IPC handlers.
export const setupUpdatedDataHandlers = (): void => {
  setupUpdatedWorkspaceHandlers()
  setupUpdatedPromptFolderHandlers()
  setupUpdatedPromptHandlers()
  setupUpdatedSystemSettingsHandlers()
}
