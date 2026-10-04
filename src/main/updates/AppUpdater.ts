import { app, BrowserWindow, ipcMain } from 'electron'
import { gt, valid } from 'semver'
import type { AppUpdateState } from '@shared/runtime/AppUpdates'
import { createUpdateSource, type UpdateRelease, type UpdateSource } from './UpdateSource'

/** Single process-wide snapshot survives renderer reloads and window navigation. */
let state: AppUpdateState
/** Release selected by the most recent successful check. */
let release: UpdateRelease | null = null
/** External updater used by this app session. */
let source: UpdateSource
/** Only the updater's own final quit may bypass the ordinary window-close guard. */
let installing = false
/** One restart timer prevents repeated renderer acknowledgements from restarting early. */
let restartTimer: ReturnType<typeof setTimeout> | undefined

/** Reports whether user close requests and additional update operations must be blocked. */
export const isUpdateBusy = (): boolean => state?.status === 'downloading' || state?.status === 'restarting'

/** Allows the installer handoff to pass through the normal window close guard. */
export const isUpdateInstalling = (): boolean => installing

/** Publishes an entire snapshot so late subscribers can recover with getState. */
const publish = (changes: Partial<AppUpdateState>): void => {
  state = { ...state, ...changes }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('app-updates-changed', state)
  }
}

/** Releases interaction and restart guards when an update fails while the app is open. */
const updateFailed = (error: Error): void => {
  console.error('Application update failed:', error)
  installing = false
  clearTimeout(restartTimer)
  restartTimer = undefined
  publish({ status: 'update-error' })
}

/** Checks stable releases without downloading or interrupting an existing operation. */
const check = async (): Promise<void> => {
  if (state.status === 'checking' || isUpdateBusy()) return
  publish({ status: 'checking', percent: 0 })
  try {
    /** Date lookup failures never prevent release discovery. */
    const [latest, currentReleaseDate] = await Promise.all([
      source.latestRelease(), source.currentReleaseDate().catch(() => null)
    ])
    release = latest && !latest.prerelease && !latest.draft ? latest : null
    if (release && !valid(release.version)) throw new Error('Invalid release version')
    /** Semantic comparison prohibits downgrades even for unpublished running versions. */
    const hasUpdate = !!release && gt(release.version, source.currentVersion)
    publish({
      status: hasUpdate ? 'available' : 'current',
      currentReleaseDate,
      latestVersion: release?.version ?? null,
      latestReleaseDate: release?.publishedAt ?? null,
      hasUpdate
    })
  } catch (error) {
    console.error('Application update check failed:', error)
    publish({ status: 'check-error' })
  }
}

/** Starts the user-authorized download and leaves restart timing to the rendered final state. */
const start = async (): Promise<void> => {
  if (source.mode !== 'installed' || !release || !state.hasUpdate ||
    (state.status !== 'available' && state.status !== 'update-error')) return
  publish({ status: 'downloading', percent: 0, transferred: 0, total: 0 })
  try {
    await source.download(release, (progress) => publish(progress))
    if (isUpdateBusy()) publish({ status: 'restarting', percent: 100 })
  } catch (error) {
    updateFailed(error as Error)
  }
}

/** Registers the updater bridge and starts the shared startup/15-minute checking loop. */
export const setupAppUpdater = (substitute?: UpdateSource): void => {
  source = substitute ?? createUpdateSource(updateFailed)
  state = {
    mode: source.mode, currentVersion: source.currentVersion, currentReleaseDate: null,
    latestVersion: null, latestReleaseDate: null, status: 'current', hasUpdate: false,
    percent: 0, transferred: 0, total: 0, notificationDismissed: false
  }
  ipcMain.handle('app-updates-state', () => state)
  ipcMain.handle('app-updates-check', () => { void check() })
  ipcMain.handle('app-updates-start', () => { void start() })
  ipcMain.handle('app-updates-dismiss', () => {
    if (state.hasUpdate && state.status !== 'checking' && state.status !== 'check-error') {
      publish({ notificationDismissed: true })
    }
  })
  ipcMain.handle('app-updates-restart', () => {
    if (state.status !== 'restarting' || restartTimer) return
    restartTimer = setTimeout(() => {
      installing = true
      try { source.install() } catch (error) { updateFailed(error as Error) }
    }, 1000)
  })
  app.on('before-quit', (event) => {
    if (isUpdateBusy() && !installing) event.preventDefault()
  })
  /** Background checks keep running after notification dismissal, without overlapping downloads. */
  const interval = setInterval(() => { void check() }, 15 * 60 * 1000)
  app.on('will-quit', () => { clearInterval(interval); clearTimeout(restartTimer) })
  void check()
}
