import { app, BrowserWindow, ipcMain } from 'electron'
import { gt, valid } from 'semver'
import type { AppUpdateState } from '@shared/runtime/AppUpdates'
import { createUpdateSource, type UpdateRelease, type UpdateSource } from './UpdateSource'
import { getRequiredSystemSettingsEntry } from '../Data/SystemSettingsData'

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
/** Highest version attempted this session prevents automatic retries of failed downloads. */
let attemptedVersion: string | null = null
/** Only this fully downloaded version may be offered for installation. */
let downloadedVersion: string | null = null
/** Exit cancellation must not report a failed update to a closing renderer. */
let quitting = false

/** Only explicit restart preparation blocks ordinary window closing. */
export const isUpdateRestarting = (): boolean => state?.status === 'restarting'

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
  if (quitting) return
  console.error('Application update failed:', error)
  installing = false
  clearTimeout(restartTimer)
  restartTimer = undefined
  publish({ status: 'update-error' })
}

/** Reads committed settings so changes apply to subsequent checks without restarting. */
const automaticUpdatesEnabled = (): boolean =>
  getRequiredSystemSettingsEntry().committed.automaticUpdates

/** Checks stable releases; only enabled automatic checks start downloading new updates. */
const check = async (automatic: boolean): Promise<void> => {
  if (automatic && !automaticUpdatesEnabled()) return
  if (state.status === 'checking' || state.status === 'downloading' || isUpdateRestarting()) return
  /** A failed background check must preserve an existing ready update or manual retry. */
  const previousStatus = state.status
  publish({ status: 'checking' })
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
      status: !hasUpdate ? 'current' : downloadedVersion === release!.version ? 'ready'
        : attemptedVersion === release!.version ? 'update-error' : 'available',
      currentReleaseDate,
      latestVersion: release?.version ?? null,
      latestReleaseDate: release?.publishedAt ?? null,
      hasUpdate
    })
    // A check that began before automatic updates were disabled must not start a download.
    if (automatic && automaticUpdatesEnabled() && hasUpdate &&
      (!attemptedVersion || gt(release!.version, attemptedVersion))) void download()
  } catch (error) {
    console.error('Application update check failed:', error)
    publish({ status: previousStatus === 'ready' || previousStatus === 'update-error' ? previousStatus : 'check-error' })
  }
}

/** Downloads automatically once per newer version or after an explicit download or retry. */
const download = async (): Promise<void> => {
  if (source.mode !== 'installed' || !release || !state.hasUpdate ||
    (state.status !== 'available' && state.status !== 'update-error')) return
  if (!attemptedVersion || gt(release.version, attemptedVersion)) attemptedVersion = release.version
  downloadedVersion = null
  publish({ status: 'downloading', percent: 0, transferred: 0, total: 0 })
  try {
    await source.download(release, (progress) => publish(progress))
    if (!quitting) {
      downloadedVersion = release.version
      publish({ status: 'ready', percent: 100 })
    }
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
  ipcMain.handle('app-updates-check', () => { void check(false) })
  ipcMain.handle('app-updates-download', () => { void download() })
  ipcMain.handle('app-updates-install', () => {
    if (state.status === 'ready') publish({ status: 'restarting' })
  })
  ipcMain.handle('app-updates-dismiss', () => {
    if (state.status === 'ready' || (state.mode === 'portable' && state.status === 'available')) {
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
    if (isUpdateRestarting() && !installing) event.preventDefault()
  })
  /** Keep the schedule while disabled so re-enabling resumes at the next 15-minute tick. */
  const interval = setInterval(() => { void check(true) }, 15 * 60 * 1000)
  app.on('will-quit', () => {
    quitting = true
    source.cancelDownload()
    clearInterval(interval)
    clearTimeout(restartTimer)
  })
  void check(true)
}
