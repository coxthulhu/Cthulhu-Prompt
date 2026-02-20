import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { compactGuid } from '@shared/compactGuid'
import {
  DEFAULT_RUNTIME_CONFIG,
  RUNTIME_ARG_PREFIX,
  normalizeRuntimeEnvironment,
  type RuntimeConfig
} from '@shared/runtimeConfig'

function loadRuntimeConfig(): RuntimeConfig {
  const runtimeFlag = process.argv.find((arg) => arg.startsWith(RUNTIME_ARG_PREFIX))

  if (!runtimeFlag) {
    return DEFAULT_RUNTIME_CONFIG
  }

  try {
    const encodedPayload = runtimeFlag.slice(RUNTIME_ARG_PREFIX.length)
    const decodedPayload = Buffer.from(encodedPayload, 'base64').toString('utf8')
    const parsed = JSON.parse(decodedPayload) as Partial<RuntimeConfig> & {
      environment?: string
    }

    const executionFolderName =
      typeof parsed.executionFolderName === 'string' ? parsed.executionFolderName : null
    const environment = normalizeRuntimeEnvironment(parsed.environment)

    return Object.freeze({
      executionFolderName,
      environment
    })
  } catch (error) {
    console.error('Failed to parse runtime config payload:', error)
    return DEFAULT_RUNTIME_CONFIG
  }
}

const runtimeConfig = loadRuntimeConfig()
const ipcClientId = compactGuid(crypto.randomUUID())

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
    contextBridge.exposeInMainWorld('ipcClientId', ipcClientId)
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
  window.ipcClientId = ipcClientId
  // @ts-expect-error (define in dts)
  window.windowControls = windowControls
}
