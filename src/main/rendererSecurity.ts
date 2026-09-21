import { shell, type BrowserWindow } from 'electron'
import { isAbsolute, relative, sep } from 'path'
import { fileURLToPath } from 'url'
import { isDevEnvironment } from './appEnvironment'

/** The only website the application may open in the user's external browser. */
const GITHUB_ISSUES_URL = 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'

/** Resolves the development server without allowing an environment variable to enable remote content. */
export function getRendererDevelopmentUrl(): URL | undefined {
  if (!isDevEnvironment() || !process.env['ELECTRON_RENDERER_URL']) return undefined

  /** Vite binds exclusively to this loopback address in electron.vite.config.ts. */
  const url = new URL(process.env['ELECTRON_RENDERER_URL'])
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
    throw new Error('The renderer development server must use http://127.0.0.1.')
  }
  return url
}

/** Restricts Chromium resource requests before startup; this is not an all-protocol network sandbox. */
export function configureRendererSecurity(
  window: BrowserWindow,
  rendererDirectory: string,
  developmentUrl: URL | undefined
): void {
  /** Checks every session request, including requests made by Monaco frames and workers. */
  const allowsResource = (address: string): boolean => {
    try {
      /** Parsed URLs avoid prefix matches accepting lookalike hosts or sibling directories. */
      const url = new URL(address)
      if (url.protocol === 'data:' || url.protocol === 'blob:') return true
      if (url.protocol === 'file:') {
        if (url.hostname) return false
        /** Relative paths reject traversal and files outside the bundled renderer directory. */
        const resourcePath = relative(rendererDirectory, fileURLToPath(url))
        return (
          !isAbsolute(resourcePath) &&
          resourcePath !== '..' &&
          !resourcePath.startsWith(`..${sep}`)
        )
      }
      return Boolean(
        developmentUrl &&
          (url.protocol === 'http:' || url.protocol === 'ws:') &&
          url.host === developmentUrl.host &&
          !url.username &&
          !url.password
      )
    } catch {
      return false
    }
  }

  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !allowsResource(details.url) })
  })

  // The application changes screens internally; document navigation is never needed.
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame || !allowsResource(event.url)) event.preventDefault()
  })
  window.webContents.on('will-redirect', (event, url) => {
    if (!allowsResource(url)) event.preventDefault()
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === GITHUB_ISSUES_URL) void shell.openExternal(url)
    return { action: 'deny' }
  })
}
