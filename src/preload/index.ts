import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  RUNTIME_ARG_PREFIX,
  normalizeRuntimeEnvironment,
  normalizeRuntimeSystemSettingsRevision,
  normalizeRuntimeSystemSettings,
  type RuntimeConfig
} from '@shared/runtimeConfig'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/tanstack/TanstackSystemSettings'

const defaultRuntimeConfig: RuntimeConfig = Object.freeze({
  devWorkspacePath: null,
  executionFolderName: null,
  environment: '',
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
  systemSettingsRevision: 0
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
    const systemSettingsRevision = normalizeRuntimeSystemSettingsRevision(
      parsed.systemSettingsRevision
    )

    return Object.freeze({
      devWorkspacePath,
      executionFolderName,
      environment,
      systemSettings,
      systemSettingsRevision
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

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('runtimeConfig', runtimeConfig)
    contextBridge.exposeInMainWorld('windowControls', windowControls)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.runtimeConfig = runtimeConfig
  // @ts-expect-error (define in dts)
  window.windowControls = windowControls
}
