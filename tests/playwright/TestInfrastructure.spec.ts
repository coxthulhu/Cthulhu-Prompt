import { test as playwrightTest, expect as playwrightExpect } from '@playwright/test'
import type { LoadSystemSettingsResult } from '@shared/domain/settings/SystemSettings'
import { DEFAULT_SYSTEM_SETTINGS, SYSTEM_SETTINGS_ID } from '@shared/domain/settings/SystemSettings'
import type { LoadUserPersistenceResult } from '@shared/domain/user-persistence/UserPersistence'
import { USER_PERSISTENCE_ID } from '@shared/domain/user-persistence/UserPersistence'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { runSqlQuery, readSystemSettings } from '../helpers/UserPersistenceHelpers'
import { checkFileExists } from '../helpers/PromptPersistenceTestHelpers'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { test, describe, expect } = createPlaywrightTestSuite()

describe('Test Infrastructure', () => {
  describe('Temporary Chromium profiles', () => {
    /** Profiles observed by this worker must disappear during test fixture teardown. */
    const profilePaths: string[] = []

    test.afterAll(() => {
      // Test-scoped Electron fixtures finish teardown before this hook runs.
      for (const profilePath of profilePaths) {
        expect(existsSync(profilePath), `Profile remains after Electron shutdown: ${profilePath}`).toBe(false)
      }
    })

    // Exercise cleanup both with Chromium storage in use and before a window is created.
    for (const completeStartup of [false, true]) {
      test(`isolates and removes the profile ${completeStartup ? 'after startup' : 'before startup'}`, async ({
        electronApp,
        testSetup
      }) => {
        if (completeStartup) await testSetup.setupAndStart()
        /** Inspect Electron's configured paths and the actual Chromium session storage location. */
        const profile = await electronApp.evaluate(({ app, session }) => ({
          userData: app.getPath('userData'),
          sessionData: app.getPath('sessionData'),
          storagePath: session.defaultSession.storagePath,
          runId: app.commandLine.getSwitchValue('playwright-run-id'),
          pid: process.pid
        }))
        profilePaths.push(profile.userData)
        expect(profile.runId).toMatch(/^[a-f0-9]{32}$/)
        expect(profile.runId).toBe(process.env.PLAYWRIGHT_RUN_ID)
        expect(profile.userData).toBe(join(tmpdir(), 'CthulhuPromptPlaywright', profile.runId, String(profile.pid)))
        expect(profile.sessionData).toBe(profile.userData)
        expect(profile.storagePath).toBe(profile.userData)
        expect(existsSync(profile.userData)).toBe(true)
      })
    }
  })

  describe('Controlled Startup Framework', () => {
    // Starting without a workspace or explicit filesystem setup must never select the host disk.
    test('uses an empty in-memory filesystem and persists startup settings in SQLite', async ({
      testSetup,
      electronApp
    }) => {
      /** Running executable exists on disk and must be invisible to the empty test volume. */
      const executablePath = await electronApp.evaluate(({ app }) => app.getPath('exe'))
      expect(await checkFileExists(electronApp, executablePath)).toBe(false)
      /** Settings must be absent before startup regardless of Chromium's on-disk profile. */
      const settingsPath = join(await electronApp.evaluate(({ app }) => app.getPath('userData')), 'SystemSettings.json')
      expect(await checkFileExists(electronApp, settingsPath)).toBe(false)

      await testSetup.setupAndStart()

      expect(await readSystemSettings(electronApp)).toEqual(DEFAULT_SYSTEM_SETTINGS)
      expect(await checkFileExists(electronApp, settingsPath)).toBe(false)
      expect(await checkFileExists(electronApp, executablePath)).toBe(false)
    })

    /** Verifies both migrated startup queries expose the shared authoritative snapshot contract. */
    test('returns startup settings and persistence as authoritative snapshots', async ({
      testSetup
    }) => {
      /** Running renderer used to invoke the registered startup queries directly. */
      const { mainWindow } = await testSetup.setupAndStart()
      /** Successful raw query responses inspected independently of renderer reconciliation. */
      const [systemSettingsResult, userPersistenceResult] = (await mainWindow.evaluate(
        async () =>
          await Promise.all([
            window.electron.ipcRenderer.invoke('load-system-settings'),
            window.electron.ipcRenderer.invoke('load-user-persistence')
          ])
      )) as [LoadSystemSettingsResult, LoadUserPersistenceResult]

      if (!systemSettingsResult.success) throw new Error(systemSettingsResult.error)
      if (!userPersistenceResult.success) throw new Error(userPersistenceResult.error)

      expect(systemSettingsResult.snapshots).toEqual([
        expect.objectContaining({
          entityType: 'systemSettings',
          id: SYSTEM_SETTINGS_ID,
          revision: expect.any(Number),
          data: expect.any(Object)
        })
      ])
      expect(userPersistenceResult.snapshots).toEqual([
        expect.objectContaining({
          entityType: 'userPersistence',
          id: USER_PERSISTENCE_ID,
          revision: expect.any(Number),
          data: expect.any(Object)
        })
      ])
    })

    test('should perform custom test setup with filesystem data', async ({
      testSetup,
      electronApp
    }) => {
      // Demonstrate direct filesystem setup for advanced cases
      await testSetup.setupFilesystem({
        '/test/file.txt': 'test content',
        '/test/dir/nested.md': '# Test heading'
      })

      const { mainWindow } = await testSetup.setupAndStart()

      // Verify that the application is running normally after our test setup
      expect(mainWindow.isClosed()).toBe(false)

      // We can also call into the main process for additional verification
      const testSetupResult = await electronApp.evaluate(async () => {
        // This could call additional test setup functions
        // For now, just verify we can communicate with the main process
        return { success: true, message: 'Test setup communication works' }
      })

      expect(testSetupResult.success).toBe(true)
      expect(testSetupResult.message).toBe('Test setup communication works')
    })

    test('should allow granular setup control for special cases', async ({ testSetup }) => {
      // Demonstrate the individual setup functions for special test cases
      await testSetup.setupFilesystem({
        '/special/case.txt': 'special content'
      })

      await testSetup.setupFileDialog(['selected-file.txt'])

      // Custom logic could go here before completing startup

      const { mainWindow } = await testSetup.setupAndStart()

      expect(mainWindow.isClosed()).toBe(false)
    })

    test('should expose schema_version table through test SQL event', async ({
      testSetup,
      electronApp
    }) => {
      await testSetup.setupAndStart()

      const queryResult = await runSqlQuery(
        electronApp,
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'"
      )

      expect(queryResult.success).toBe(true)
      expect(queryResult.rows).toHaveLength(1)
      expect(queryResult.rows?.[0]).toMatchObject({ name: 'schema_version' })

      const versionResult = await runSqlQuery(
        electronApp,
        'SELECT version FROM schema_version LIMIT 1'
      )

      expect(versionResult.success).toBe(true)
      expect(versionResult.rows?.[0]).toMatchObject({ version: 27 })

      /** Only schema metadata and the unified state table remain. */
      const tables = await runSqlQuery(electronApp, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      expect(tables.rows).toEqual([{ name: 'schema_version' }, { name: 'workspace_state' }])
      /** Nullable key columns support application-wide and workspace-wide state. */
      const columns = await runSqlQuery(electronApp, 'PRAGMA table_info(workspace_state)')
      expect(columns.rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'workspace_id', type: 'TEXT', notnull: 0 }),
        expect.objectContaining({ name: 'entity_id', type: 'TEXT', notnull: 0 }),
        expect.objectContaining({ name: 'state_type', type: 'TEXT', notnull: 1 }),
        expect.objectContaining({ name: 'storage_scope', type: 'TEXT', notnull: 1 }),
        expect.objectContaining({ name: 'data_json', type: 'TEXT', notnull: 1 })
      ]))
    })
  })

  describe('Error and Edge Case Scenarios', () => {
    test('should have no window when hung on startup', async ({ electronApp }) => {
      // The app should be launched but hung - no windows should exist yet
      const windows = electronApp.windows()
      expect(windows).toHaveLength(0)

      // Verify the app is still running but in hung state
      const isRunning = await electronApp.evaluate(({ app }) => {
        return app.isReady()
      })
      expect(isRunning).toBe(true)

      // Verify that the hung flag is set correctly
      const isHung = await electronApp.evaluate(() => {
        return process.env.DEV_ENVIRONMENT === 'PLAYWRIGHT'
      })
      expect(isHung).toBe(true)
    })

    test('should check file existence in mocked filesystem via custom event', async ({
      electronApp,
      testSetup
    }) => {
      // Setup filesystem with test files
      await testSetup.setupFilesystem({
        '/test/existing-file.txt': 'This file exists',
        '/test/another-file.md': '# Header\nContent here'
      })

      // Test file that should exist
      await electronApp.evaluate(async ({ app }, filePath) => {
        app.emit('test-check-file-exists', filePath)
      }, '/test/existing-file.txt')

      await expect
        .poll(async () => {
          return await electronApp.evaluate(() => {
            return (global as any).testFileExistsResult
          })
        })
        .toBe(true)

      // Test file that should not exist
      await electronApp.evaluate(async ({ app }, filePath) => {
        app.emit('test-check-file-exists', filePath)
      }, '/test/nonexistent-file.txt')

      await expect
        .poll(async () => {
          return await electronApp.evaluate(() => {
            return (global as any).testFileExistsResult
          })
        })
        .toBe(false)

      // Verify no windows were created during this test
      const windows = electronApp.windows()
      expect(windows).toHaveLength(0)
    })
  })
})

// Lightweight browser smoke test (merged from smoke.spec.ts).
playwrightTest('placeholder passes', async ({ page }) => {
  await page.goto('about:blank')
  playwrightExpect(page.url()).toContain('about:blank')
})
