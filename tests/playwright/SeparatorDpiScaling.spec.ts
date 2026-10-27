import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

// The dedicated suite launches Electron at fractional Windows display scaling.
const { test, describe, expect } = createPlaywrightTestSuite({
  launchOptions: {
    args: ['--force-device-scale-factor=1.25']
  }
})

describe('Separator DPI scaling', () => {
  test('renders horizontal separator borders as one device pixel', async ({
    testSetup
  }) => {
    // The empty-workspace home card exposes a normal horizontal Separator.
    const { mainWindow } = await testSetup.setupAndStart({
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
  })
})

for (const scale of [1, 1.25, 1.5, 2, 4]) {
  const { test, describe, expect } = createPlaywrightTestSuite({
    launchOptions: { args: [`--force-device-scale-factor=${scale}`] }
  })

  describe(`Split button at ${scale * 100}% DPI`, () => {
    test('keeps only one device pixel between the hover surfaces', async ({
      testSetup
    }, testInfo) => {
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })
      await testHelpers.clickNavButton('Test Screen')
      const splitButton = mainWindow.locator('.cthulhuUiSplitIconButton').first()
      const separator = splitButton.locator('.cthulhuUiSplitIconButtonSeparator')

      for (const side of ['Main', 'Chevron']) {
        await splitButton.locator(`.cthulhuUiSplitIconButton${side}`).hover()
        const metrics = await separator.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          const mainBounds = element.previousElementSibling!.getBoundingClientRect()
          const chevronBounds = element.nextElementSibling!.getBoundingClientRect()
          return {
            devicePixelRatio,
            borderWidth: parseFloat(style.borderLeftWidth),
            width: bounds.width,
            leftGap: bounds.left - mainBounds.right,
            rightGap: chevronBounds.left - bounds.right
          }
        })
        expect(metrics.devicePixelRatio).toBe(scale)
        expect(metrics.borderWidth * scale).toBeCloseTo(1, 5)
        // Layout units can round slightly; the old 1 CSS pixel box fails at fractional DPI.
        expect(metrics.width * scale).toBeCloseTo(1, 1)
        expect(Math.abs(metrics.leftGap)).toBeLessThanOrEqual(1)
        expect(Math.abs(metrics.rightGap)).toBeLessThanOrEqual(1)
        await splitButton.screenshot({
          path: testInfo.outputPath(`${side.toLowerCase()}-hover.png`),
          animations: 'disabled',
          scale: 'device'
        })
      }
    })
  })
}
