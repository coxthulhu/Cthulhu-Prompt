import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite({
  launchOptions: {
    args: ['--force-device-scale-factor=1.25']
  }
})

describe('Prompt tree DPI scaling', () => {
  test('keeps indent guides one device pixel wide at 125 percent scaling', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories-ui' }
    })

    await testHelpers.navigateToPromptFolders('Hierarchy')
    const guide = mainWindow
      .locator('[data-testid="prompt-tree-active-prompt-categories-ui-second-category-prompt"]')
      .locator('[data-indent-guide-line]')
      .first()
    await expect(guide).toBeVisible()

    const guideMetrics = await guide.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        devicePixelRatio,
        borderLeftWidth: style.borderLeftWidth,
        left: rect.left,
        right: rect.right,
        width: rect.width
      }
    })
    const guideScreenshot = await guide.screenshot({ animations: 'disabled', scale: 'device' })

    expect(guideMetrics.devicePixelRatio).toBe(1.25)
    expect(guideMetrics.borderLeftWidth).toBe('0.8px')
    expect(guideMetrics.width).toBeCloseTo(0.8, 5)
    expect(guideScreenshot.readUInt32BE(16)).toBe(1)
  })
})
