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
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
  systemSettingsVersion: 0
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
    const systemSettingsVersion =
      typeof parsed.systemSettingsVersion === 'number' ? parsed.systemSettingsVersion : 0

    return Object.freeze({
      devWorkspacePath,
      executionFolderName,
      environment,
      systemSettings,
      systemSettingsVersion
    })
  } catch (error) {
    console.error('Failed to parse runtime config payload:', error)
    return defaultRuntimeConfig
  }
}

const runtimeConfig = loadRuntimeConfig()

const windowControls = {
  minimize: () => electronAPI.ipcRenderer.invoke('window-minimize'),
  toggleMaximize: () => electronAPI.ipcRenderer.invoke('window-toggle-maximize'),
  close: () => electronAPI.ipcRenderer.invoke('window-close'),
  confirmClose: () => electronAPI.ipcRenderer.invoke('window-confirm-close'),
  isMaximized: () => electronAPI.ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: unknown, isMaximized: boolean) => {
      callback(isMaximized)
    }
    electronAPI.ipcRenderer.on('window-maximize-changed', listener)
    return () => {
      electronAPI.ipcRenderer.removeListener('window-maximize-changed', listener)
    }
  },
  onCloseRequested: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    electronAPI.ipcRenderer.on('window-close-requested', listener)
    return () => {
      electronAPI.ipcRenderer.removeListener('window-close-requested', listener)
    }
  }
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
    electronAPI.ipcRenderer.invoke('load-prompts', { workspacePath, folderName }),
  updatePromptFolderDescription: (
    workspacePath: string,
    folderName: string,
    folderDescription: string
  ) =>
    electronAPI.ipcRenderer.invoke('update-prompt-folder-description', {
      workspacePath,
      folderName,
      folderDescription
    })
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('promptAPI', promptAPI)
    contextBridge.exposeInMainWorld('runtimeConfig', runtimeConfig)
    contextBridge.exposeInMainWorld('windowControls', windowControls)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.promptAPI = promptAPI
  // @ts-expect-error (define in dts)
  window.runtimeConfig = runtimeConfig
  // @ts-expect-error (define in dts)
  window.windowControls = windowControls
}
