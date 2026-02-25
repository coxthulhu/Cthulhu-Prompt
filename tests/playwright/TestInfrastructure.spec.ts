import { test as playwrightTest, expect as playwrightExpect } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

describe('Test Infrastructure', () => {
  describe('Controlled Startup Framework', () => {
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

    test('should allow granular setup control for special cases', async ({
      testSetup,
      electronApp
    }) => {
      // Demonstrate the individual setup functions for special test cases
      await testSetup.setupFilesystem({
        '/special/case.txt': 'special content'
      })

      await testSetup.setupFileDialog(['selected-file.txt'])

      // Custom logic could go here before completing startup

      await testSetup.completeStartup()

      // Now can access mainWindow through electronApp if needed
      const mainWindow = await electronApp.firstWindow()
      await mainWindow.waitForLoadState('domcontentloaded')

      expect(mainWindow.isClosed()).toBe(false)
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
