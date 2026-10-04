import { app } from 'electron'
import { NsisUpdater } from 'electron-updater'
import type { UpdateMode } from '@shared/runtime/AppUpdates'
import { isDevEnvironment } from '../appEnvironment'

/** GitHub metadata needed for version comparison and a pinned installer download. */
export type UpdateRelease = {
  tag: string
  version: string
  publishedAt: string | null
  prerelease: boolean
  draft: boolean
}

/** Download measurements passed through to the existing progress bar. */
export type UpdateProgress = { percent: number; transferred: number; total: number }

/** External boundaries replaced by the controlled Playwright updater. */
export interface UpdateSource {
  mode: UpdateMode
  currentVersion: string
  latestRelease: () => Promise<UpdateRelease | null>
  currentReleaseDate: () => Promise<string | null>
  download: (release: UpdateRelease, progress: (value: UpdateProgress) => void) => Promise<void>
  install: () => void
}

/** GitHub release fields read from its public REST API. */
type GithubRelease = { tag_name: string; published_at: string | null; prerelease: boolean; draft: boolean }

/** Reads release metadata in main, independently of the renderer's network restrictions. */
const fetchRelease = async (suffix: string): Promise<GithubRelease | null> => {
  /** A bounded request restores the Check button when GitHub cannot be reached. */
  const response = await fetch(`https://api.github.com/repos/coxthulhu/Cthulhu-Prompt/releases/${suffix}`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30000)
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`GitHub release check failed (${response.status})`)
  return await response.json() as GithubRelease
}

/** Creates the Windows release source; installation is called only for installed distributions. */
export const createUpdateSource = (onError: (error: Error) => void): UpdateSource => {
  /** The running version remains available internally even when the UI says DEV BUILD. */
  const currentVersion = app.getVersion()
  /** Portable executables publish these variables before launching Electron. */
  const mode: UpdateMode = !app.isPackaged || isDevEnvironment()
    ? 'development'
    : process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR
      ? 'portable'
      : 'installed'
  /** A fresh updater on each attempt also resets failed installation state for retries. */
  let updater: NsisUpdater | undefined
  return {
    mode,
    currentVersion,
    latestRelease: async () => {
      /** GitHub's latest endpoint excludes drafts and prereleases. */
      const release = await fetchRelease('latest')
      return release && {
        tag: release.tag_name,
        version: release.tag_name.replace(/^v/, ''),
        publishedAt: release.published_at,
        prerelease: release.prerelease,
        draft: release.draft
      }
    },
    currentReleaseDate: async () => (await fetchRelease(`tags/v${currentVersion}`))?.published_at ?? null,
    download: async (release, progress) => {
      updater = new NsisUpdater({
        provider: 'generic',
        url: `https://github.com/coxthulhu/Cthulhu-Prompt/releases/download/${encodeURIComponent(release.tag)}/`
      })
      updater.autoDownload = false
      updater.autoInstallOnAppQuit = false
      updater.allowPrerelease = false
      updater.allowDowngrade = false
      updater.on('error', onError)
      updater.on('download-progress', progress)
      /** Pin metadata to the displayed release so a later publication cannot change the target. */
      const result = await updater.checkForUpdates()
      if (!result?.isUpdateAvailable || result.updateInfo.version !== release.version) {
        throw new Error('The selected update is no longer available.')
      }
      await updater.downloadUpdate()
    },
    install: () => updater!.quitAndInstall(true, true)
  }
}
