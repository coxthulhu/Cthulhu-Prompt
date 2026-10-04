/** Runtime distribution determines whether installation is supported. */
export type UpdateMode = 'installed' | 'portable' | 'development'

/** User-visible stages owned by the main-process updater. */
export type UpdateStatus = 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'restarting' | 'check-error' | 'update-error'

/** Complete updater snapshot shared with the renderer. */
export type AppUpdateState = {
  mode: UpdateMode
  currentVersion: string
  currentReleaseDate: string | null
  latestVersion: string | null
  latestReleaseDate: string | null
  status: UpdateStatus
  hasUpdate: boolean
  percent: number
  transferred: number
  total: number
  notificationDismissed: boolean
}

/** Narrow preload contract for observing and controlling application updates. */
export type AppUpdatesApi = {
  getState: () => Promise<AppUpdateState>
  check: () => Promise<void>
  /** Explicitly retries downloading the latest discovered update. */
  download: () => Promise<void>
  /** Requests installation of the downloaded update after saving renderer changes. */
  install: () => Promise<void>
  restart: () => Promise<void>
  dismiss: () => Promise<void>
  onChange: (callback: (state: AppUpdateState) => void) => () => void
}

/** Public release page used by every distribution. */
export const APP_RELEASES_URL = 'https://github.com/coxthulhu/Cthulhu-Prompt/releases'
