import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { controlUpdater } from '../helpers/AppUpdateHelpers'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { runSqlStatement, seedUserPersistence } from '../helpers/UserPersistenceHelpers'
import { focusMonacoEditor, getMonacoEditorText, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { readPersistedPromptTextById } from '../helpers/PromptPersistenceTestHelpers'

/** Production updater UI and service run with controlled release/download/install boundaries. */
const { test, describe, expect } = createPlaywrightTestSuite()

// Release window guards after assertions so a failed test cannot strand a controlled download.
test.afterEach(async ({ electronApp }) => {
  await electronApp.evaluate(({ app, BrowserWindow }) => {
    app.removeAllListeners('before-quit')
    for (const window of BrowserWindow.getAllWindows()) window.removeAllListeners('close')
  })
})

describe('App updates', () => {
  test('checks at startup, keeps progress visible, and supports manual checks and the release link', async ({ electronApp, testSetup }) => {
    await controlUpdater(electronApp, { type: 'configure', config: { holdCheck: true } })
    /** Startup runs independently of the deliberately pending release check. */
    const { mainWindow } = await testSetup.setupAndStart()
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await mainWindow.getByTestId('app-updates-button').click()
    /** Nonmodal popup is placed beside the activity rail, matching the approved mockup. */
    const popup = mainWindow.getByTestId('app-updates-popup')
    await expect(popup).toHaveAttribute('aria-modal', 'false')
    await expect(popup.getByTestId('update-action')).toBeDisabled()
    await expect(popup).toContainText('Checking for updates')
    await expect(popup.getByRole('progressbar')).toBeVisible()
    await expect.poll(() => popup.evaluate((element) => {
      /** Primary action fills the popup body's available width. */
      const action = element.querySelector('[data-testid="update-action"]')!.getBoundingClientRect()
      /** Release link must align with both edges of the full-width primary action. */
      const releases = element.querySelector('[data-testid="update-releases-link"]')!.getBoundingClientRect()
      return Math.abs(releases.left - action.left) <= 1 && Math.abs(releases.right - action.right) <= 1
    })).toBe(true)
    await expect.poll(() => popup.locator('.cthulhuUiPopupSurface').evaluate((element) => {
      /** Viewport offsets must remain within one CSS pixel. */
      const bounds = element.getBoundingClientRect()
      return Math.abs(bounds.left - 58) <= 1 && Math.abs(window.innerHeight - bounds.bottom - 10) <= 1
    })).toBe(true)
    await controlUpdater(electronApp, { type: 'complete-check' })
    await expect(popup).toContainText('No updates available')
    await expect(popup.getByTestId('update-current-version')).toHaveText('1.0.0')
    await expect(popup.getByTestId('update-latest-version')).toHaveText('1.0.0')
    await expect(popup.getByTestId('update-current-date')).toHaveText('Sep 14, 2026')
    await expect(popup.getByTestId('update-latest-card')).toHaveAttribute('data-available', 'false')
    await popup.getByTestId('update-action').click()
    await expect(popup.getByTestId('update-action')).toBeDisabled()
    expect((await controlUpdater(electronApp, { type: 'stats' })).checks).toBe(2)
    await controlUpdater(electronApp, { type: 'complete-check' })
    await expect(popup.getByTestId('update-action')).toBeEnabled()
    await mainWindow.mouse.click(5, 5)
    await expect(popup).toBeVisible()
    await electronApp.evaluate(({ app, shell }) => {
      /** Capture the OS handoff without launching a real browser. */
      shell.openExternal = async (url) => { (app as any).updateReleaseUrl = url }
    })
    await popup.getByTestId('update-releases-link').click()
    await expect.poll(() => electronApp.evaluate(({ app }) => (app as any).updateReleaseUrl)).toBe('https://github.com/coxthulhu/Cthulhu-Prompt/releases')
    await popup.getByRole('button', { name: 'Close updates' }).click()
    await expect(popup).toHaveCount(0)
  })

  test('waits for startup overlay and the Welcome creation dialog before automatically opening', async ({ electronApp, testSetup }) => {
    /** Restoring a seeded workspace gives startup a real asynchronous loading gate. */
    const workspacePath = '/ws/update-startup'
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, []))
    await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath) })
    await controlUpdater(electronApp, { type: 'configure', config: { latestVersion: '1.1.0' } })
    await testSetup.pauseIpcChannel('load-workspace-by-path')
    await testSetup.completeStartup()
    /** Access the window before the shared setup helper waits for the overlay to disappear. */
    const mainWindow = await electronApp.firstWindow()
    await mainWindow.waitForSelector('[data-testid="app-sidebar"]', { state: 'visible' })
    await expect(mainWindow.getByTestId('startup-loading-overlay')).toBeVisible()
    await expect.poll(() => mainWindow.evaluate(() => window.appUpdates.getState().then((state) => state.status))).toBe('available')
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await testSetup.resumeIpcChannel('load-workspace-by-path')
    /** The first-launch introduction takes over after restoration. */
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(welcome).toBeVisible()
    await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await welcome.getByTestId('welcome-create-workspace-button').click()
    /** Follow-up dialog must not briefly expose the update popup between dialog transitions. */
    const create = mainWindow.getByRole('dialog', { name: 'Create Workspace', exact: true })
    await expect(create).toBeVisible()
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await create.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(mainWindow.getByTestId('app-updates-popup')).toBeVisible()
    await expect(mainWindow.getByTestId('update-latest-card')).toHaveAttribute('data-available', 'true')
    await expect(mainWindow.getByTestId('update-available-dot')).toBeVisible()
  })

  test('waits through the Welcome native picker and its error dialog', async ({ electronApp, testSetup }) => {
    await controlUpdater(electronApp, { type: 'configure', config: { holdCheck: true, latestVersion: '1.1.0' } })
    /** Keep the real provider pending at the native Windows picker boundary. */
    await electronApp.evaluate(({ app, dialog }) => {
      app.emit('test-setup-file-dialog', null)
      dialog.showOpenDialog = (() => new Promise((resolve) => {
        ;(app as any).finishUpdatePicker = () => resolve({ canceled: false, filePaths: ['/ws/missing.cthulhuprompt.json'] })
      })) as typeof dialog.showOpenDialog
    })
    /** First-launch user chooses the native Open flow. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    await mainWindow.getByTestId('welcome-open-workspace-button').click()
    await expect.poll(() => electronApp.evaluate(({ app }) => !!(app as any).finishUpdatePicker)).toBe(true)
    await controlUpdater(electronApp, { type: 'complete-check' })
    await expect.poll(() => mainWindow.evaluate(() => window.appUpdates.getState().then((state) => state.status))).toBe('available')
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await electronApp.evaluate(({ app }) => (app as any).finishUpdatePicker())
    /** Failed workspace loading still belongs to the Welcome flow. */
    const errorDialog = mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace', exact: true })
    await expect(errorDialog).toBeVisible()
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await errorDialog.getByRole('button', { name: 'Close', exact: true }).first().click()
    await expect(mainWindow.getByTestId('app-updates-popup')).toBeVisible()
    testSetup.removeRendererErrorsContaining('IPC invocation error')
    testSetup.removeRendererErrorsContaining('missing.cthulhuprompt.json')
  })

  test('waits until the returning-user startup overlay finishes fading', async ({ electronApp, testSetup }) => {
    /** A returning user has no Welcome dialog to mask overlay gating. */
    const workspacePath = '/ws/update-overlay'
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, []))
    await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath) })
    await runSqlStatement(electronApp, 'UPDATE app_persistence SET has_shown_welcome = 1 WHERE id = 1')
    await controlUpdater(electronApp, { type: 'configure', config: { latestVersion: '1.1.0' } })
    await testSetup.pauseIpcChannel('load-workspace-by-path')
    await testSetup.completeStartup()
    /** Observe every DOM transition instead of relying on sampling a short fade. */
    const mainWindow = await electronApp.firstWindow()
    await mainWindow.waitForSelector('[data-testid="app-sidebar"]', { state: 'visible' })
    await expect(mainWindow.getByTestId('startup-loading-overlay')).toBeVisible()
    await expect.poll(() => mainWindow.evaluate(() => window.appUpdates.getState().then((state) => state.status))).toBe('available')
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await mainWindow.evaluate(() => {
      /** Any overlap is retained even if it disappears before the final assertion. */
      ;(window as any).updateOverlayOverlap = false
      new MutationObserver(() => {
        if (document.querySelector('[data-testid="startup-loading-overlay"]') &&
          document.querySelector('[data-testid="app-updates-popup"]')) {
          ;(window as any).updateOverlayOverlap = true
        }
      }).observe(document.body, { subtree: true, childList: true })
    })
    await testSetup.resumeIpcChannel('load-workspace-by-path')
    await expect(mainWindow.getByTestId('app-updates-popup')).toBeVisible()
    expect(await mainWindow.evaluate(() => (window as any).updateOverlayOverlap)).toBe(false)
    await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
  })

  for (const manuallyOpened of [false, true]) {
    test(`keeps 15-minute checks after ${manuallyOpened ? 'manual' : 'automatic'} notification dismissal without reopening`, async ({ electronApp, testSetup }) => {
      await controlUpdater(electronApp, { type: 'configure', config: { holdCheck: true, latestVersion: '1.1.0' } })
      /** The manually opened variant first closes during checking, which must not mute notifications. */
      const { mainWindow } = await testSetup.setupAndStart()
      if (manuallyOpened) {
        await mainWindow.getByTestId('app-updates-button').click()
        await mainWindow.getByRole('button', { name: 'Close updates' }).click()
        expect((await mainWindow.evaluate(() => window.appUpdates.getState())).notificationDismissed).toBe(false)
        await mainWindow.getByTestId('app-updates-button').click()
      }
      await controlUpdater(electronApp, { type: 'complete-check' })
      /** Both entry paths now display an actual update. */
      const popup = mainWindow.getByTestId('app-updates-popup')
      await expect(popup).toContainText('Update available')
      if (manuallyOpened) {
        await popup.getByRole('button', { name: 'Close updates' }).focus()
        await mainWindow.keyboard.press('Escape')
      } else {
        await popup.getByRole('button', { name: 'Close updates' }).click()
      }
      await expect.poll(() => mainWindow.evaluate(() => window.appUpdates.getState().then((state) => state.notificationDismissed))).toBe(true)
      await controlUpdater(electronApp, { type: 'configure', config: { holdCheck: false, latestVersion: '1.2.0' } })
      expect((await controlUpdater(electronApp, { type: 'interval' })).intervalMs).toBe(900000)
      await expect.poll(() => mainWindow.evaluate(() => window.appUpdates.getState().then((state) => state.latestVersion))).toBe('1.2.0')
      await expect(popup).toHaveCount(0)
      await mainWindow.reload()
      await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
      await mainWindow.getByTestId('app-updates-button').click()
      await expect(popup.getByTestId('update-latest-version')).toHaveText('1.2.0')
    })
  }

  test('automatically opens for a periodic update after no update was available', async ({ electronApp, testSetup }) => {
    /** Startup finds the running version and leaves the popup closed. */
    const { mainWindow } = await testSetup.setupAndStart()
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await mainWindow.getByTestId('app-updates-button').click()
    await expect(mainWindow.getByTestId('app-updates-popup')).toContainText('No updates available')
    await mainWindow.getByRole('button', { name: 'Close updates' }).click()
    await controlUpdater(electronApp, { type: 'configure', config: { latestVersion: '1.1.0' } })
    await controlUpdater(electronApp, { type: 'interval' })
    await expect(mainWindow.getByTestId('app-updates-popup')).toBeVisible()
  })

  for (const mode of ['portable', 'development'] as const) {
    test(`${mode} shows releases but never downloads or installs`, async ({ electronApp, testSetup }) => {
      await controlUpdater(electronApp, { type: 'configure', config: { mode, latestVersion: '1.1.0', dateError: true, latestDate: null } })
      /** Both restricted distribution modes use the same production state machine. */
      const { mainWindow } = await testSetup.setupAndStart()
      if (mode === 'development') {
        await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
        await mainWindow.getByTestId('app-updates-button').click()
      }
      /** Portable updates notify automatically but require a manual release download. */
      const popup = mainWindow.getByTestId('app-updates-popup')
      await expect(popup).toBeVisible()
      await expect(popup.getByTestId('update-current-version')).toHaveText(mode === 'development' ? 'DEV BUILD' : '1.0.0')
      await expect(popup.getByTestId('update-latest-version')).toHaveText('1.1.0')
      await expect(popup.getByTestId('update-current-date')).toHaveText('—')
      await expect(popup.getByTestId('update-latest-date')).toHaveText('—')
      await expect(popup.getByTestId('update-action')).toHaveText('Update & Restart')
      await expect(popup.getByTestId('update-action')).toBeDisabled()
      if (mode === 'portable') await expect(popup).toContainText('Portable copies cannot auto-update.')
      await mainWindow.evaluate(() => window.appUpdates.start())
      expect((await controlUpdater(electronApp, { type: 'stats' })).downloads).toBe(0)
    })
  }

  test('shows a lower public version without offering a downgrade and ignores prereleases', async ({ electronApp, testSetup }) => {
    await controlUpdater(electronApp, { type: 'configure', config: { currentVersion: '2.0.0', latestVersion: '1.9.0' } })
    /** An unpublished running build may be newer than the latest public release. */
    const { mainWindow } = await testSetup.setupAndStart()
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await mainWindow.getByTestId('app-updates-button').click()
    await expect(mainWindow.getByTestId('update-current-version')).toHaveText('2.0.0')
    await expect(mainWindow.getByTestId('update-latest-version')).toHaveText('1.9.0')
    await expect(mainWindow.getByTestId('update-action')).toHaveText('Check for Updates')
    await expect(mainWindow.getByTestId('update-latest-card')).toHaveAttribute('data-available', 'false')
    await mainWindow.evaluate(() => window.appUpdates.start())
    expect((await controlUpdater(electronApp, { type: 'stats' })).downloads).toBe(0)
    await controlUpdater(electronApp, { type: 'configure', config: { latestVersion: '3.0.0-beta.1', prerelease: true } })
    await mainWindow.getByTestId('update-action').click()
    await expect(mainWindow.getByTestId('app-updates-popup')).toContainText('No updates available')
    await mainWindow.evaluate(() => window.appUpdates.start())
    expect((await controlUpdater(electronApp, { type: 'stats' })).downloads).toBe(0)
  })

  test('does not notify on a failed startup check and allows retry', async ({ electronApp, testSetup }) => {
    await controlUpdater(electronApp, { type: 'configure', config: { checkError: true } })
    /** Failed discovery does not interrupt startup. */
    const { mainWindow } = await testSetup.setupAndStart()
    await expect(mainWindow.getByTestId('app-updates-popup')).toHaveCount(0)
    await mainWindow.getByTestId('app-updates-button').click()
    await expect(mainWindow.getByTestId('app-updates-popup')).toContainText('Unable to check for updates')
    await expect(mainWindow.getByTestId('update-action')).toBeEnabled()
    await controlUpdater(electronApp, { type: 'configure', config: { checkError: false } })
    await mainWindow.getByTestId('update-action').click()
    await expect(mainWindow.getByTestId('app-updates-popup')).toContainText('No updates available')
  })

  test('blocks interaction and Windows closing during download, restores interaction on errors, and retries', async ({ electronApp, testSetup }) => {
    await controlUpdater(electronApp, { type: 'configure', config: { latestVersion: '1.1.0', installError: true } })
    /** Available installed update enters the real blocking download flow. */
    const { mainWindow } = await testSetup.setupAndStart()
    /** Same popup remains mounted when switching between nonmodal and modal presentation. */
    const popup = mainWindow.getByTestId('app-updates-popup')
    await popup.getByTestId('update-action').click()
    try {
      await expect(popup).toHaveAttribute('aria-modal', 'true')
      await expect(popup.getByRole('button', { name: 'Close updates' })).toBeDisabled()
      await expect(popup.getByTestId('update-action')).toBeDisabled()
      await expect.poll(async () => (await controlUpdater(electronApp, { type: 'stats' })).downloads).toBe(1)
      await controlUpdater(electronApp, { type: 'progress', progress: { percent: 42, transferred: 42 * 1048576, total: 100 * 1048576 } })
      await expect(popup.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
      await expect(popup).toContainText('42.0 MB of 100.0 MB')
      await mainWindow.keyboard.press('Escape')
      await mainWindow.getByTestId('nav-button-settings').focus()
      await expect(mainWindow.getByTestId('nav-button-settings')).not.toBeFocused()
      /** Real pointer coordinates exercise the modal backdrop, without forced DOM clicks. */
      const settingsBounds = (await mainWindow.getByTestId('nav-button-settings').boundingBox())!
      await mainWindow.mouse.click(settingsBounds.x + settingsBounds.width / 2, settingsBounds.y + settingsBounds.height / 2)
      await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
      await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
      await mainWindow.evaluate(() => window.windowControls.confirmClose())
      await expect(popup).toBeVisible()
      await controlUpdater(electronApp, { type: 'interval' })
      expect((await controlUpdater(electronApp, { type: 'stats' })).checks).toBe(1)
      await controlUpdater(electronApp, { type: 'fail-download' })
      await expect(popup).toContainText('Update failed')
      await expect(popup).toHaveAttribute('aria-modal', 'false')
      await mainWindow.getByTestId('nav-button-settings').click()
      await expect(mainWindow.getByTestId('settings-screen')).toBeVisible()
      await popup.getByTestId('update-action').click()
      await expect.poll(async () => (await controlUpdater(electronApp, { type: 'stats' })).downloads).toBe(2)
      await controlUpdater(electronApp, { type: 'complete-download' })
      await expect(popup).toContainText('Restarting to install')
      await expect(popup.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
      await expect(popup).toContainText('Update failed')
      await expect(popup).toHaveAttribute('aria-modal', 'false')
      await expect(popup.getByTestId('update-action')).toBeEnabled()
      expect((await controlUpdater(electronApp, { type: 'stats' })).downloads).toBe(2)
    } finally {
      await controlUpdater(electronApp, { type: 'fail-download' })
    }
  })

  test('flushes pending edits, shows 100 percent for a second, and blocks closing until installer handoff', async ({ electronApp, testSetup }) => {
    /** Start without an update so the fixture can open its workspace and editor normally. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })
    await testHelpers.navigateToPromptFolders('Development')
    /** The existing sample editor has real pending autosaves to flush during restart. */
    const editor = '[data-testid="prompt-editor-dev-1"]'
    await waitForMonacoEditor(mainWindow, editor)
    await testSetup.pauseIpcChannel('update-prompt')
    await focusMonacoEditor(mainWindow, editor)
    await mainWindow.keyboard.insertText('[update-save]')
    await expect.poll(() => getMonacoEditorText(mainWindow, editor)).toContain('[update-save]')
    await controlUpdater(electronApp, { type: 'configure', config: { latestVersion: '1.1.0' } })
    await controlUpdater(electronApp, { type: 'interval' })
    /** Update popup appears above the still-mounted editor. */
    const popup = mainWindow.getByTestId('app-updates-popup')
    await popup.getByTestId('update-action').click()
    try {
      await expect.poll(async () => (await controlUpdater(electronApp, { type: 'stats' })).downloads).toBe(1)
      await controlUpdater(electronApp, { type: 'complete-download' })
      await expect(popup).toContainText('Restarting to install')
      await expect(popup.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
      await electronApp.evaluate(({ BrowserWindow, app }) => {
        BrowserWindow.getAllWindows()[0].close()
        app.quit()
      })
      await expect(popup).toBeVisible()
      // Exceed the restart countdown: installation must still be waiting for the held save.
      await mainWindow.waitForTimeout(1100)
      expect((await controlUpdater(electronApp, { type: 'stats' })).installs).toBe(0)
      expect(await readPersistedPromptTextById(electronApp, {
        workspacePath: '/ws/sample', folderName: 'Development', promptId: 'dev-1', promptTitle: 'Code Review'
      })).not.toContain('[update-save]')
      /** Main-process clock measures the real restart delay, independently of renderer timing. */
      const releasedAt = await electronApp.evaluate(() => Date.now())
      await testSetup.resumeIpcChannel('update-prompt')
      await expect.poll(() => readPersistedPromptTextById(electronApp, {
        workspacePath: '/ws/sample', folderName: 'Development', promptId: 'dev-1', promptTitle: 'Code Review'
      })).toContain('[update-save]')
      await expect.poll(async () => (await controlUpdater(electronApp, { type: 'stats' })).installs).toBe(1)
      expect((await controlUpdater(electronApp, { type: 'stats' })).installedAt! - releasedAt).toBeGreaterThanOrEqual(1000)
    } finally {
      await testSetup.resumeIpcChannel('update-prompt')
      await controlUpdater(electronApp, { type: 'fail-download' })
    }
  })

  test('continues restarting after a pending prompt save fails', async ({ electronApp, testSetup }) => {
    /** Real editor and mutation machinery provide a failing pending save. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })
    await testHelpers.navigateToPromptFolders('Development')
    /** Hold the real IPC save boundary, then return a controlled persistence failure. */
    await electronApp.evaluate(({ app, ipcMain }) => {
      ipcMain.removeHandler('update-prompt')
      ipcMain.handle('update-prompt', () => new Promise((resolve) => {
        ;(app as any).failUpdateSave = () => resolve({ success: false, error: 'Controlled update save failure' })
      }))
    })
    /** Existing sample prompt receives an edit that cannot reach disk. */
    const editor = '[data-testid="prompt-editor-dev-1"]'
    await waitForMonacoEditor(mainWindow, editor)
    await focusMonacoEditor(mainWindow, editor)
    await mainWindow.keyboard.insertText('[update-save-failure]')
    await controlUpdater(electronApp, { type: 'configure', config: { latestVersion: '1.1.0' } })
    await controlUpdater(electronApp, { type: 'interval' })
    await mainWindow.getByTestId('update-action').click()
    await expect.poll(async () => (await controlUpdater(electronApp, { type: 'stats' })).downloads).toBe(1)
    await controlUpdater(electronApp, { type: 'complete-download' })
    await expect(mainWindow.getByTestId('app-updates-popup')).toContainText('Restarting to install')
    await expect.poll(() => electronApp.evaluate(({ app }) => !!(app as any).failUpdateSave)).toBe(true)
    // Prove save completion is awaited before the one-second installation countdown.
    await mainWindow.waitForTimeout(1100)
    expect((await controlUpdater(electronApp, { type: 'stats' })).installs).toBe(0)
    await electronApp.evaluate(({ app }) => (app as any).failUpdateSave())
    await expect.poll(async () => (await controlUpdater(electronApp, { type: 'stats' })).installs).toBe(1)
    expect(await readPersistedPromptTextById(electronApp, {
      workspacePath: '/ws/sample', folderName: 'Development', promptId: 'dev-1', promptTitle: 'Code Review'
    })).not.toContain('[update-save-failure]')
    testSetup.removeRendererErrorsContaining('IPC invocation error')
    testSetup.removeRendererErrorsContaining('Controlled update save failure')
  })
})
