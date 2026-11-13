import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { measureIconTextInk } from '../helpers/IconTextAlignmentHelpers'

/** Flat-topped capitals without descenders, so the sidebar title's ink spans exactly cap height to baseline. */
const PROJECT_NAME = 'TITLE'

// Each suite launches Chromium at a real Windows display scale, where rounding differs per scale.
for (const scale of [1, 1.25, 1.5]) {
  const { test, describe, expect } = createPlaywrightTestSuite({
    launchOptions: { args: [`--force-device-scale-factor=${scale}`] }
  })

  describe(`Sidebar header at ${scale * 100}% DPI`, () => {
    test('centers the Manage Projects icon on the project title capitals', async ({ testSetup }) => {
      const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })

      // Saving a project created from + opens it, so its name becomes the sidebar title.
      await mainWindow.getByTestId('new-project-button').click()
      /** Manage Projects dialog holding the new draft. */
      const dialog = mainWindow.getByRole('dialog', { name: 'Manage Projects' })
      await dialog.getByTestId('manage-project-name-input').fill(PROJECT_NAME)
      await dialog.getByTestId('manage-project-abbreviation-input').fill('TI')
      await dialog.getByTestId('manage-projects-save-button').click()
      await expect(dialog).toHaveCount(0)
      await expect(mainWindow.getByTestId('sidebar-title')).toHaveText(PROJECT_NAME)
      await expect(mainWindow.getByTestId('sidebar-manage-projects-button')).toBeVisible()
      // Keep the pointer off the header so no hover surface changes the measured pixels.
      await mainWindow.mouse.move(0, 0)

      const ink = await measureIconTextInk(mainWindow, 'sidebar-manage-projects-button', 'sidebar-title')
      expect(ink.devicePixelRatio).toBe(scale)
      // Both scans must find real ink rather than a blank or misaligned region that matches every row.
      for (const { height } of [ink.text, ink.icon]) {
        expect(height).toBeGreaterThan(5 * scale)
        expect(height).toBeLessThan(ink.scanHeight)
      }
      // Centers fall on half device pixels, so this allows only the 0.5px left by odd/even ink heights.
      // The original box-centered icon sat 2 device pixels off at 125% and 1 at 150%.
      expect(Math.abs(ink.text.center - ink.icon.center)).toBeLessThan(1)
      expect(Math.abs(ink.iconOffsetX)).toBeLessThanOrEqual(1)
    })
  })
}
