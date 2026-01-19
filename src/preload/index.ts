import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  RUNTIME_ARG_PREFIX,
  normalizeRuntimeEnvironment,
  normalizeRuntimeSystemSettings,
  type RuntimeConfig
} from '@shared/runtimeConfig'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/systemSettings'

const defaultRuntimeConfig: RuntimeConfig = Object.freeze({
  devWorkspacePath: null,
  executionFolderName: null,
  environment: '',
  systemSettings: DEFAULT_SYSTEM_SETTINGS
})

function loadRuntimeConfig(): RuntimeConfig {
  const runtimeFlag = process.argv.find((arg) => arg.startsWith(RUNTIME_ARG_PREFIX))

  if (!runtimeFlag) {
    return defaultRuntimeConfig
  }

  try {
    const encodedPayload = runtimeFlag.slice(RUNTIME_ARG_PREFIX.length)
    const decodedPayload = Buffer.from(encodedPayload, 'base64').toString('utf8')
    const parsed = JSON.parse(decodedPayload) as Partial<RuntimeConfig> & {
      environment?: string
    }

    const devWorkspacePath =
      typeof parsed.devWorkspacePath === 'string' ? parsed.devWorkspacePath : null
    const executionFolderName =
      typeof parsed.executionFolderName === 'string' ? parsed.executionFolderName : null
    const environment = normalizeRuntimeEnvironment(parsed.environment)
    const systemSettings = normalizeRuntimeSystemSettings(parsed.systemSettings)

    return Object.freeze({
      devWorkspacePath,
      executionFolderName,
      environment,
      systemSettings
    })
  } catch (error) {
    console.error('Failed to parse runtime config payload:', error)
    return defaultRuntimeConfig
  }
}

const runtimeConfig = loadRuntimeConfig()

// Workspace APIs for renderer
const workspaceAPI = {
  openSelectWorkspaceFolderDialog: () => electronAPI.ipcRenderer.invoke('select-workspace-folder'),
  checkFolderExists: (folderPath: string) =>
    electronAPI.ipcRenderer.invoke('check-folder-exists', folderPath),
  createWorkspace: (workspacePath: string, includeExamplePrompts: boolean) =>
    electronAPI.ipcRenderer.invoke('create-workspace', {
      workspacePath,
      includeExamplePrompts
    }),
  createPromptFolder: (workspacePath: string, displayName: string) =>
    electronAPI.ipcRenderer.invoke('create-prompt-folder', {
      workspacePath,
      displayName
    }),
  loadPromptFolders: (workspacePath: string) =>
    electronAPI.ipcRenderer.invoke('load-prompt-folders', workspacePath)
}

// Prompt APIs for renderer
const promptAPI = {
  createPrompt: (
    workspacePath: string,
    folderName: string,
    title: string,
    promptText: string,
    previousPromptId?: string | null
  ) =>
    electronAPI.ipcRenderer.invoke('create-prompt', {
      workspacePath,
      folderName,
      title,
      promptText,
      previousPromptId
    }),
  updatePrompt: (
    workspacePath: string,
    folderName: string,
    id: string,
    title: string,
    promptText: string
  ) =>
    electronAPI.ipcRenderer.invoke('update-prompt', {
      workspacePath,
      folderName,
      id,
      title,
      promptText
    }),
  deletePrompt: (workspacePath: string, folderName: string, id: string) =>
    electronAPI.ipcRenderer.invoke('delete-prompt', { workspacePath, folderName, id }),
  loadPrompts: (workspacePath: string, folderName: string) =>
    electronAPI.ipcRenderer.invoke('load-prompts', { workspacePath, folderName })
}

// Combined API for backward compatibility
const api = {
  ...workspaceAPI,
  ...promptAPI
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('workspaceAPI', workspaceAPI)
    contextBridge.exposeInMainWorld('promptAPI', promptAPI)
    contextBridge.exposeInMainWorld('api', api) // Backward compatibility
    contextBridge.exposeInMainWorld('runtimeConfig', runtimeConfig)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.workspaceAPI = workspaceAPI
  // @ts-expect-error (define in dts)
  window.promptAPI = promptAPI
  // @ts-expect-error (define in dts)
  window.api = api // Backward compatibility
  // @ts-expect-error (define in dts)
  window.runtimeConfig = runtimeConfig
}
