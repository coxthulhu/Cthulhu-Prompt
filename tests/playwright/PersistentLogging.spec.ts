import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

/** Playwright primitives configured for the Electron integration environment. */
const { test, describe, expect } = createPlaywrightTestSuite()

/** Finds the one persistent log entry containing a unique test marker. */
const getMarkedLogEntry = (logContents: string, marker: string): string =>
  logContents.split('\n\n').find((entry) => entry.includes(marker)) ?? ''

describe('Persistent renderer logging', () => {
  test('writes complete stacks for handled and unhandled renderer errors', async ({
    testSetup,
    electronApp
  }) => {
    /** Running renderer whose error is forwarded through preload to the main process. */
    const { mainWindow } = await testSetup.setupAndStart()
    /** Unique text that distinguishes these entries from retained logs and parallel runs. */
    const errorMarker = `renderer-stack-${Date.now().toString(36)}`

    await electronApp.evaluate(async ({ app }) => {
      app.emit('test-initialize-persistent-logging')
    })

    await mainWindow.evaluate((marker) => {
      /** Leaf frame that constructs the handled renderer Error captured by console.error. */
      function handledRendererStackLeaf(): void {
        console.error(new Error(`${marker}-handled`))
      }

      /** Parent frame used to prove handled logging retains more than the first location. */
      function handledRendererStackRoot(): void {
        handledRendererStackLeaf()
      }

      /** Frame that proves string-only console errors receive a captured call-site stack. */
      function stringRendererStack(): void {
        console.error(`${marker}-string`)
      }

      /** Schedules a named throwing frame that reaches the global error event. */
      function uncaughtRendererStack(): void {
        setTimeout(function throwUncaughtRendererError() {
          throw new Error(`${marker}-uncaught`)
        })
      }

      /** Frame retained when a rejected promise reaches the global rejection event. */
      function rejectedRendererStack(): void {
        void Promise.reject(new Error(`${marker}-rejected`))
      }

      handledRendererStackRoot()
      stringRendererStack()
      uncaughtRendererStack()
      rejectedRendererStack()
    }, errorMarker)

    /** Reads the real persistent log rather than the mocked workspace filesystem. */
    const readPersistentLog = async (): Promise<string> =>
      await electronApp.evaluate(async ({ app }) => {
        /** Native filesystem module used by the production log writer. */
        const fs = process.getBuiltinModule('node:fs')
        /** Native path module used to resolve the application log file. */
        const path = process.getBuiltinModule('node:path')
        /** Current persistent log path selected by Electron. */
        const logPath = path.join(app.getPath('logs'), 'cthulhu-prompt.log')

        return fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''
      })

    await expect
      .poll(async () => {
        /** Latest log contents used to wait for every asynchronous error report. */
        const logContents = await readPersistentLog()
        return (
          getMarkedLogEntry(logContents, `${errorMarker}-handled`).includes(
            'at handledRendererStackLeaf'
          ) &&
          getMarkedLogEntry(logContents, `${errorMarker}-handled`).includes(
            'at handledRendererStackRoot'
          ) &&
          getMarkedLogEntry(logContents, `${errorMarker}-string`).includes(
            'at stringRendererStack'
          ) &&
          getMarkedLogEntry(logContents, `${errorMarker}-uncaught`).includes(
            'at throwUncaughtRendererError'
          ) &&
          getMarkedLogEntry(logContents, `${errorMarker}-rejected`).includes(
            'at rejectedRendererStack'
          )
        )
      })
      .toBe(true)

    /** Log contents inspected after the asynchronous renderer IPC has arrived. */
    const logContents = await readPersistentLog()
    expect(getMarkedLogEntry(logContents, `${errorMarker}-handled`)).toContain(
      'at handledRendererStackLeaf'
    )
    expect(getMarkedLogEntry(logContents, `${errorMarker}-handled`)).toContain(
      'at handledRendererStackRoot'
    )
    expect(getMarkedLogEntry(logContents, `${errorMarker}-string`)).toContain(
      'at stringRendererStack'
    )
    expect(getMarkedLogEntry(logContents, `${errorMarker}-uncaught`)).toContain(
      'at throwUncaughtRendererError'
    )
    expect(getMarkedLogEntry(logContents, `${errorMarker}-rejected`)).toContain(
      'at rejectedRendererStack'
    )

    testSetup.removeRendererErrorsContaining(errorMarker)
  })
})
