import { app } from 'electron'
import type { EventEmitter } from 'node:events'
import type { UpdateMode } from '@shared/runtime/AppUpdates'
import type { UpdateProgress, UpdateRelease, UpdateSource } from '../updates/UpdateSource'

/** Updater inputs configurable before normal startup or between checks. */
export type TestUpdateConfig = {
  mode: UpdateMode
  currentVersion: string
  latestVersion: string
  currentDate: string | null
  latestDate: string | null
  prerelease: boolean
  draft: boolean
  holdCheck: boolean
  checkError: boolean
  dateError: boolean
  installError: boolean
}

/** Observable boundary calls prove tests exercise the production service. */
export type TestUpdateStats = {
  checks: number
  downloads: number
  installs: number
  intervalMs: number
  installedAt: number | null
}

/** Commands control external results, without writing application updater state directly. */
export type TestUpdateCommand =
  | { type: 'configure'; config: Partial<TestUpdateConfig> }
  | { type: 'complete-check' | 'complete-download' | 'fail-download' | 'interval' | 'stats' }
  | { type: 'progress'; progress: UpdateProgress }

/** Provides offline release/download/install boundaries for every Playwright launch. */
export const createTestAppUpdater = (): UpdateSource => {
  /** Returning-user defaults avoid unsolicited notifications in unrelated tests. */
  const config: TestUpdateConfig = {
    mode: 'installed', currentVersion: '1.0.0', latestVersion: '1.0.0',
    currentDate: '2026-09-14T12:00:00Z', latestDate: '2026-09-14T12:00:00Z',
    prerelease: false, draft: false, holdCheck: false, checkError: false,
    dateError: false, installError: false
  }
  /** Counts real service calls and records its actual interval configuration. */
  const stats: TestUpdateStats = { checks: 0, downloads: 0, installs: 0, intervalMs: 0, installedAt: null }
  /** Pending GitHub response can be held through startup and native-dialog workflows. */
  let finishCheck: (() => void) | undefined
  /** Controlled completion and failure of the active download. */
  let finishDownload: (() => void) | undefined
  /** Rejects the active download without invoking real networking. */
  let failDownload: ((error: Error) => void) | undefined
  /** Reports real-looking progress through the production service callback. */
  let reportProgress: ((value: UpdateProgress) => void) | undefined
  /** Captured production interval callback allows a test to advance one 15-minute tick. */
  let intervalTick: (() => void) | undefined
  /** Preserve normal timer behavior for all application timers, including restart countdown. */
  const originalInterval = global.setInterval
  global.setInterval = ((callback: () => void, milliseconds: number, ...args: unknown[]) => {
    if (milliseconds === 15 * 60 * 1000) {
      stats.intervalMs = milliseconds
      intervalTick = callback
    }
    return originalInterval(callback, milliseconds, ...args)
  }) as typeof setInterval

  ;(app as EventEmitter).on('test-updater', (command: TestUpdateCommand) => {
    if (command.type === 'configure') Object.assign(config, command.config)
    if (command.type === 'complete-check') finishCheck?.()
    if (command.type === 'progress') reportProgress?.(command.progress)
    if (command.type === 'complete-download') finishDownload?.()
    if (command.type === 'fail-download') failDownload?.(new Error('Controlled download failure'))
    if (command.type === 'interval') intervalTick?.()
    app.emit('test-updater-result', { ...stats })
  })

  return {
    get mode() { return config.mode },
    get currentVersion() { return config.currentVersion },
    latestRelease: async (): Promise<UpdateRelease> => {
      stats.checks += 1
      if (config.holdCheck) await new Promise<void>((resolve) => { finishCheck = resolve })
      if (config.checkError) throw new Error('Controlled check failure')
      return {
        tag: `v${config.latestVersion}`, version: config.latestVersion, publishedAt: config.latestDate,
        prerelease: config.prerelease, draft: config.draft
      }
    },
    currentReleaseDate: async () => {
      if (config.dateError) throw new Error('Controlled date lookup failure')
      return config.currentDate
    },
    download: async (_release, progress) => {
      stats.downloads += 1
      reportProgress = progress
      await new Promise<void>((resolve, reject) => { finishDownload = resolve; failDownload = reject })
    },
    install: () => {
      if (config.installError) throw new Error('Controlled installation failure')
      stats.installs += 1
      stats.installedAt = Date.now()
    }
  }
}
