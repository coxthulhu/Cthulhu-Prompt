import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  LoadPromptFoldersResult as SharedLoadPromptFoldersResult,
  LoadPromptsResult as SharedLoadPromptsResult,
  PromptFolderResult as SharedPromptFolderResult,
  PromptResult as SharedPromptResult,
  WorkspaceResult as SharedWorkspaceResult
} from '@shared/ipc'
import type { RuntimeConfig } from '@shared/runtimeConfig'

type WorkspaceResult = SharedWorkspaceResult
type PromptFolderResult = SharedPromptFolderResult
type LoadPromptFoldersResult = SharedLoadPromptFoldersResult
type PromptResult = SharedPromptResult
type LoadPromptsResult = SharedLoadPromptsResult

interface WorkspaceAPI {
  openSelectWorkspaceFolderDialog: () => Promise<{ dialogCancelled: boolean; filePaths: string[] }>
  checkFolderExists: (folderPath: string) => Promise<boolean>
  createWorkspace: (workspacePath: string, includeExamplePrompts: boolean) => Promise<WorkspaceResult>
  createPromptFolder: (workspacePath: string, displayName: string) => Promise<PromptFolderResult>
  loadPromptFolders: (workspacePath: string) => Promise<LoadPromptFoldersResult>
}

interface PromptAPI {
  createPrompt: (
    workspacePath: string,
    folderName: string,
    title: string,
    promptText: string,
    previousPromptId?: string | null
  ) => Promise<PromptResult>
  updatePrompt: (
    workspacePath: string,
    folderName: string,
    id: string,
    title: string,
    promptText: string
  ) => Promise<PromptResult>
  deletePrompt: (workspacePath: string, folderName: string, id: string) => Promise<WorkspaceResult>
  loadPrompts: (workspacePath: string, folderName: string) => Promise<LoadPromptsResult>
  updatePromptFolderDescription: (
    workspacePath: string,
    folderName: string,
    folderDescription: string
  ) => Promise<WorkspaceResult>
}

// Combined API for backward compatibility
interface CombinedAPI extends WorkspaceAPI, PromptAPI {}

interface WindowControls {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    workspaceAPI: WorkspaceAPI
    promptAPI: PromptAPI
    api: CombinedAPI // Backward compatibility
    runtimeConfig: RuntimeConfig
    windowControls: WindowControls
  }
}
