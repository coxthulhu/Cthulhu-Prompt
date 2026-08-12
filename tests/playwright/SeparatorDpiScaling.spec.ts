import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

// The dedicated suite launches Electron at fractional Windows display scaling.
const { test, describe, expect } = createPlaywrightTestSuite({
  launchOptions: {
    args: ['--force-device-scale-factor=1.25']
  }
})

describe('Separator DPI scaling', () => {
  test('renders horizontal and vertical separator borders as one device pixel', async ({
    testSetup
  }) => {
    // The empty-workspace home card exposes a normal horizontal Separator.
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    // The first card divider provides the horizontal border under test.
    const horizontalSeparator = mainWindow
      .locator('[data-testid="home-primary-card"] .cthulhuUiSeparator')
      .first()
    await expect(horizontalSeparator).toBeVisible()

    // Computed metrics confirm Chromium snapped the CSS border to one physical pixel.
    const horizontalMetrics = await horizontalSeparator.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        devicePixelRatio,
        borderTopWidth: style.borderTopWidth,
        height: bounds.height
      }
    })
    expect(horizontalMetrics.devicePixelRatio).toBe(1.25)
    expect(horizontalMetrics.borderTopWidth).toBe('0.8px')
    expect(horizontalMetrics.height).toBe(1)
    expect(parseFloat(horizontalMetrics.borderTopWidth) * horizontalMetrics.devicePixelRatio).toBe(
      1
    )

    await testHelpers.clickNavButton('Test Screen')
    // The compound button exposes a normal vertical Separator.
    const verticalSeparator = mainWindow
      .locator('.cthulhuUiIconButtonWithMoreOptionsSeparator')
      .first()
    await verticalSeparator.scrollIntoViewIfNeeded()
    await expect(verticalSeparator).toBeVisible()

    // Computed metrics confirm the vertical border uses the same physical-pixel snapping.
    const verticalMetrics = await verticalSeparator.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        devicePixelRatio,
        borderLeftWidth: style.borderLeftWidth,
        width: bounds.width
      }
    })

    expect(verticalMetrics.devicePixelRatio).toBe(1.25)
    expect(verticalMetrics.borderLeftWidth).toBe('0.8px')
    expect(verticalMetrics.width).toBe(1)
    expect(parseFloat(verticalMetrics.borderLeftWidth) * verticalMetrics.devicePixelRatio).toBe(1)
  })
})
