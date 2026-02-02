import { ElectronAPI } from '@electron-toolkit/preload'
import type { RuntimeConfig } from '@shared/runtimeConfig'

interface WindowControls {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  confirmClose: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
  onCloseRequested: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    runtimeConfig: RuntimeConfig
    windowControls: WindowControls
  }
}
