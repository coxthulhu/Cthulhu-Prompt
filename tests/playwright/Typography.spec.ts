import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

describe('Typography', () => {
  test('keeps shared component line heights within 1px of their original sizes', async ({ testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await mainWindow.getByTestId('nav-button-test-screen').click()
    const gallery = mainWindow.locator('.test-screen-shell')
    await expect(gallery).toBeVisible()

    // Original line heights guard against inheritance changes while font sizes are standardized.
    const samples = [
      { selector: '.cthulhuUiTitle[data-variant="page"]', fontSize: 28, lineHeight: 42 },
      { selector: '.cthulhuUiTitle[data-variant="small"]', fontSize: 14, lineHeight: 21 },
      { selector: '.cthulhuUiTitle[data-variant="card"]', fontSize: 18, lineHeight: 27 },
      { selector: '.cthulhuUiTitle[data-variant="dialog"]', fontSize: 18, lineHeight: 27 },
      { selector: '.cthulhuUiTitle[data-variant="row"]', fontSize: 16, lineHeight: 24 },
      { selector: '.cthulhuUiSubtitle', fontSize: 14, lineHeight: 21 },
      { selector: '.cthulhuUiRowDetailExtra', fontSize: 14, lineHeight: 21 },
      { selector: '.cthulhuUiValuePill', fontSize: 14, lineHeight: 17.5 },
      { selector: '.cthulhuUiNumericStepperInputNative', fontSize: 14, lineHeight: 17.5 },
      { selector: '.cthulhuUiNumericStepperInputHelper', fontSize: 12, lineHeight: 15 },
      { selector: '.cthulhuUiSelectorButtonText', fontSize: 14, lineHeight: 21 },
      { selector: '.cthulhuUiSelectorButtonDetail', fontSize: 12, lineHeight: 18 },
      { selector: '.cthulhuUiAccordionLabel', fontSize: 14, lineHeight: 19.5 },
      { selector: '.cthulhuUiInfoRow', fontSize: 13, lineHeight: 18 },
      { selector: '.cthulhuUiAccordionCount', fontSize: 12, lineHeight: 18 }
    ]

    for (const sample of samples) {
      const element = gallery.locator(sample.selector).first()
      await expect(element).toBeAttached()
      const actual = await element.evaluate((node) => {
        const style = getComputedStyle(node)
        return { fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) }
      })
      expect(actual.fontSize, sample.selector).toBe(sample.fontSize)
      expect(Math.abs(actual.lineHeight - sample.lineHeight), sample.selector).toBeLessThanOrEqual(1)
    }
  })
})
