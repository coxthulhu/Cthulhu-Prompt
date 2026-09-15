import { ElectronAPI } from '@electron-toolkit/preload'
import type { RuntimeConfig } from '@shared/runtime/runtimeConfig'
import type { RendererErrorReport } from '@shared/ipc/RendererErrorReport'

interface WindowControls {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  confirmClose: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
  onCloseRequested: (callback: () => void) => () => void
}

/** Renderer-facing API for forwarding complete error details to persistent logging. */
interface RendererLogging {
  reportError: (report: RendererErrorReport) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    runtimeConfig: RuntimeConfig
    ipcClientId: string
    windowControls: WindowControls
    rendererLogging: RendererLogging
  }
}
