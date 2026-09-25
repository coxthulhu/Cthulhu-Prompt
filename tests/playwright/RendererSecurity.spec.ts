import { createServer } from 'node:http'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

/** Uses the production Electron startup and existing workspace fixtures. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Renderer security', () => {
  test('loads the internal DevTools frontend and automatic theme resources', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    const windowId = await electronApp.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.webContents.openDevTools({ mode: 'undocked' })
      return window.id
    })
    await expect.poll(() => electronApp.evaluate(({ BrowserWindow }, id) => {
      return BrowserWindow.fromId(id)!.webContents.isDevToolsOpened()
    }, windowId)).toBe(true)
    await expect.poll(() => electronApp.evaluate(async ({ BrowserWindow }, id) => {
      const devTools = BrowserWindow.fromId(id)!.webContents.devToolsWebContents
      if (!devTools || devTools.isLoading()) return false
      return devTools.executeJavaScript('Boolean(document.querySelector(".root-view"))')
    }, windowId)).toBe(true)

    await expect.poll(() => electronApp.evaluate(async ({ BrowserWindow }, id) => {
      const contents = BrowserWindow.fromId(id)!.webContents.devToolsWebContents!
      return contents.executeJavaScript(
        'Array.from(document.styleSheets, sheet => sheet.href).filter(Boolean)'
      )
    }, windowId)).toEqual(expect.arrayContaining([expect.stringMatching(/^devtools:\/\/theme\/colors\.css/)]))
    await electronApp.evaluate(({ BrowserWindow }, id) => {
      BrowserWindow.fromId(id)!.webContents.closeDevTools()
    }, windowId)
  })

  /** The development exception allows one exact HTTP/WS origin without opening other network access. */
  test('allows only the configured development server and blocks remote redirects', async ({
    electronApp,
    testSetup
  }) => {
    /** Minimal development document isolates origin enforcement from Vite and application startup. */
    const server = createServer((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { Location: 'https://example.invalid/redirect-target' })
      } else {
        response.setHeader('Content-Type', 'text/html')
      }
      response.end('<!doctype html><title>Local development server</title>')
    })
    server.on('upgrade', (request, socket) => {
      /** Standard handshake proves an allowed WebSocket actually reaches this server. */
      const accept = createHash('sha1')
        .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest('base64')
      socket.end(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
      )
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    /** The test server stands in for Vite's dynamically assigned loopback port. */
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      await electronApp.evaluate((_electron, origin) => {
        process.env.DEV_ENVIRONMENT = 'DEV'
        process.env.ELECTRON_RENDERER_URL = origin
      }, origin)
      await testSetup.completeStartup()
      /** Wait for the real startup path to load the permitted development document. */
      const mainWindow = await electronApp.firstWindow()
      await mainWindow.waitForLoadState('domcontentloaded')
      await expect(mainWindow).toHaveTitle('Local development server')
      /** Exercise Vite's renderer-initiated reload, rather than Playwright's privileged reload API. */
      await mainWindow.evaluate(() => {
        document.body.dataset.beforeReload = 'true'
      })
      await Promise.all([
        mainWindow.waitForEvent('domcontentloaded'),
        mainWindow.evaluate(() => location.reload())
      ])
      expect(await mainWindow.evaluate(() => document.body.dataset.beforeReload)).toBeUndefined()
      expect(mainWindow.url()).toBe(`${origin}/`)

      /** The reload exception must not allow another document on the same development server. */
      await electronApp.evaluate(({ app, BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].webContents.once('will-frame-navigate', (event) => {
          ;(app as any).developmentNavigationBlocked = event.defaultPrevented
        })
      })
      await mainWindow.evaluate(() => {
        location.href = '/other-document'
      })
      await expect.poll(() => electronApp.evaluate(({ app }) =>
        (app as any).developmentNavigationBlocked
      )).toBe(true)
      expect(mainWindow.url()).toBe(`${origin}/`)
      expect(await mainWindow.evaluate(async () => (await fetch('/allowed')).ok)).toBe(true)
      expect(await mainWindow.evaluate(async (origin) => {
        return await new Promise<boolean>((resolve) => {
          /** A valid handshake must succeed on the allowed development port. */
          const socket = new WebSocket(origin.replace('http:', 'ws:'))
          socket.onopen = () => {
            socket.close()
            resolve(true)
          }
          socket.onerror = () => resolve(false)
        })
      }, origin)).toBe(true)
      /** A different port and a redirect away from Vite must both be canceled by Electron. */
      /** Select a distinct ordinary port, avoiding Chromium's unsafe-port rejection. */
      const otherPort = (server.address() as AddressInfo).port === 54321 ? 54322 : 54321
      for (const address of [`http://127.0.0.1:${otherPort}/blocked`, `${origin}/redirect`]) {
        /** Observe cancellation instead of accepting any generic fetch failure. */
        const failure = mainWindow.waitForEvent('requestfailed')
        expect(await mainWindow.evaluate(async (address) => {
          return await fetch(address).then(() => false, () => true)
        }, address)).toBe(true)
        expect((await failure).failure()?.errorText).toBe('net::ERR_BLOCKED_BY_CLIENT')
      }
      testSetup.removeRendererErrorsContaining('net::ERR_BLOCKED_BY_CLIENT')
      expect(testSetup.getRendererErrors()).toEqual([])
    } finally {
      // The minimal test document has no application close-confirmation listener.
      await electronApp.evaluate(({ BrowserWindow }) => {
        for (const window of BrowserWindow.getAllWindows()) window.removeAllListeners('close')
      })
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  /** Exercises Electron's filter independently of the document CSP, against a reachable server. */
  test('blocks network resources from the page, Monaco frame, and workers', async ({ testSetup }) => {
    /** Requests received here would demonstrate a renderer network policy bypass. */
    const received: string[] = []
    /** Reachable loopback endpoint avoids relying on an unavailable internet host. */
    const server = createServer((request, response) => {
      received.push(request.url ?? '')
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.end('unexpected network content')
    })
    server.on('upgrade', (request, socket) => {
      received.push(request.url ?? '')
      socket.destroy()
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    /** Actual listening address used for every attempted network access. */
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    try {
      /** A sample workspace loads the real Monaco extension iframe and bundled workers. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'sample' }
      })
      await testHelpers.navigateToPromptFolders('Development')
      await expect(mainWindow.locator('iframe.web-worker-ext-host-iframe')).toBeAttached()
      expect(testSetup.getRendererErrors()).toEqual([])

      /** Bypass only CSP so a passing test must be enforced by the main process. */
      const cdp = await mainWindow.context().newCDPSession(mainWindow)
      await cdp.send('Page.enable')
      await cdp.send('Page.setBypassCSP', { enabled: true })
      await mainWindow.reload()
      await testHelpers.navigateToPromptFolders('Development')
      await expect(mainWindow.locator('iframe.web-worker-ext-host-iframe')).toBeAttached()

      /** Captured failures distinguish Electron cancellation from DNS or connection failures. */
      const failures: string[] = []
      mainWindow.on('requestfailed', (request) => {
        if (request.url().startsWith(origin)) failures.push(request.failure()?.errorText ?? '')
      })

      /** Each probe resolves on the browser's failure event, never merely on a timeout. */
      const blocked = await mainWindow.evaluate(async (origin) => {
        /** Fetch must reject even with the page CSP bypassed. */
        const fetchBlocked = await fetch(`${origin}/fetch`).then(() => false, () => true)
        /** Images and scripts must fail before reaching the server. */
        const resourceBlocked = async (kind: 'img' | 'script'): Promise<boolean> => {
          /** The detached element is attached to initiate its resource load. */
          const element = document.createElement(kind)
          return await new Promise<boolean>((resolve) => {
            element.onload = () => {
              element.remove()
              resolve(false)
            }
            element.onerror = () => {
              element.remove()
              resolve(true)
            }
            element.src = `${origin}/${kind}`
            document.body.append(element)
          })
        }
        /** WebSockets use a separate browser API but must obey the same session restriction. */
        const socketBlocked = await new Promise<boolean>((resolve) => {
          /** No server handshake is allowed in a packaged renderer. */
          const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/socket`)
          socket.onopen = () => {
            socket.close()
            resolve(false)
          }
          socket.onerror = () => resolve(true)
        })
        return [
          fetchBlocked,
          await resourceBlocked('img'),
          await resourceBlocked('script'),
          socketBlocked
        ]
      }, origin)
      expect(blocked).toEqual([true, true, true, true])
      expect(failures).toEqual([
        'net::ERR_BLOCKED_BY_CLIENT',
        'net::ERR_BLOCKED_BY_CLIENT',
        'net::ERR_BLOCKED_BY_CLIENT'
      ])

      /** The real extension iframe permits loopback in its own CSP; Electron must still block it. */
      await expect.poll(() => mainWindow.frames().some(
        (frame) => frame.url().includes('webWorkerExtensionHostIframe')
      )).toBe(true)
      /** Loaded Monaco frame used to probe requests outside the main document's CSP. */
      const extensionFrame = mainWindow.frames().find(
        (frame) => frame.url().includes('webWorkerExtensionHostIframe')
      )!
      expect(await extensionFrame.evaluate(async (origin) => {
        return await fetch(`${origin}/iframe`).then(() => false, () => true)
      }, origin)).toBe(true)

      /** A blob worker mirrors Monaco's in-memory bootstrap and inherits the iframe's CSP. */
      expect(await extensionFrame.evaluate(async (origin) => {
        /** In-memory worker code attempts a real fetch through the renderer session. */
        const workerUrl = URL.createObjectURL(new Blob([
          `fetch(${JSON.stringify(`${origin}/worker`)}).then(() => postMessage(false), () => postMessage(true))`
        ], { type: 'text/javascript' }))
        /** Terminate the probe and release its blob after receiving the result. */
        const worker = new Worker(workerUrl)
        return await new Promise<boolean>((resolve) => {
          worker.onmessage = (event) => {
            worker.terminate()
            URL.revokeObjectURL(workerUrl)
            resolve(event.data)
          }
        })
      }, origin)).toBe(true)
      expect(failures).toHaveLength(5)
      expect(failures.every((failure) => failure === 'net::ERR_BLOCKED_BY_CLIENT')).toBe(true)
      expect(received).toEqual([])
      testSetup.removeRendererErrorsContaining('net::ERR_BLOCKED_BY_CLIENT')
      testSetup.removeRendererErrorsContaining(
        `WebSocket connection to '${origin.replace('http:', 'ws:')}/socket'`
      )
      expect(testSetup.getRendererErrors()).toEqual([])
      await cdp.detach()
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  /** Local files outside the renderer bundle must not become another source of scripts or data. */
  test('allows bundled files and blocks files outside the renderer directory', async ({ testSetup }) => {
    /** Production document URL supplies real existing bundle and main-process file paths. */
    const { mainWindow } = await testSetup.setupAndStart()
    /** An existing sibling file ensures failure cannot be attributed to a missing file. */
    const outsideUrl = new URL('../main/index.js', mainWindow.url()).href
    /** Electron must explicitly cancel the out-of-bundle request. */
    const failedRequest = mainWindow.waitForEvent('requestfailed', (request) => request.url() === outsideUrl)
    expect(await mainWindow.evaluate(async (outsideUrl) => {
      return await fetch(outsideUrl).then(() => false, () => true)
    }, outsideUrl)).toBe(true)
    expect((await failedRequest).failure()?.errorText).toBe('net::ERR_BLOCKED_BY_CLIENT')
    expect(await mainWindow.evaluate(async () => (await fetch(location.href)).ok)).toBe(true)
    testSetup.removeRendererErrorsContaining('net::ERR_BLOCKED_BY_CLIENT')
    expect(testSetup.getRendererErrors()).toEqual([])
  })

  /** Navigation and popups must not replace the app or hand arbitrary URLs to the operating system. */
  test('blocks navigation and opens only the GitHub issues link externally', async ({
    electronApp,
    testSetup
  }) => {
    /** Capture browser launches without opening a real browser during the test. */
    await electronApp.evaluate(({ app, shell }) => {
      /** Test-only collection lives in the main process beside the stubbed shell API. */
      ;(app as any).externalUrls = []
      shell.openExternal = async (url) => {
        ;(app as any).externalUrls.push(url)
      }
    })
    /** The settings screen exposes the existing supported external link. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.navigateToSettingsScreen()
    await mainWindow.getByTestId('about-github-issues-link').click()
    await expect.poll(() => electronApp.evaluate(({ app }) => (app as any).externalUrls)).toEqual([
      'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
    ])
    await mainWindow.evaluate(() => {
      window.open('https://example.invalid/')
      window.open('https://github.com/coxthulhu/Cthulhu-Prompt/issues?unexpected=true')
      window.open('file:///C:/Windows/win.ini')
    })
    /** Observe the actual navigation event before checking that its default action was canceled. */
    await electronApp.evaluate(({ app, BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.once('will-frame-navigate', (event) => {
        ;(app as any).navigationBlocked = event.defaultPrevented
      })
    })
    /** The entry URL must survive a renderer-initiated navigation attempt. */
    const entryUrl = mainWindow.url()
    await mainWindow.evaluate(() => {
      location.href = 'https://example.invalid/navigation'
    })
    await expect.poll(() => electronApp.evaluate(({ app }) => (app as any).navigationBlocked)).toBe(true)
    expect(mainWindow.url()).toBe(entryUrl)
    expect(await electronApp.evaluate(({ app }) => (app as any).externalUrls)).toEqual([
      'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
    ])
    expect(electronApp.windows()).toHaveLength(1)
  })
})
