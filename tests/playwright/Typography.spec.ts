import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

describe('Typography', () => {
  // Computed styles catch inherited line heights and CSS overrides of the Tailwind scale.
  test('uses standard text sizes and preserves explicit button line heights', async ({ testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await mainWindow.getByTestId('nav-button-test-screen').click()
    const gallery = mainWindow.locator('.test-screen-shell')
    await expect(gallery).toBeVisible()

    // Approved typography values include the compact button exceptions.
    const samples = [
      { selector: '.cthulhuUiTitle[data-variant="page"]', fontSize: 30, lineHeight: 36 },
      { selector: '.cthulhuUiTitle[data-variant="small"]', fontSize: 14, lineHeight: 20 },
      { selector: '.cthulhuUiTitle[data-variant="card"]', fontSize: 18, lineHeight: 28 },
      { selector: '.cthulhuUiTitle[data-variant="dialog"]', fontSize: 18, lineHeight: 28 },
      { selector: '.cthulhuUiTitle[data-variant="row"]', fontSize: 16, lineHeight: 24 },
      { selector: '.cthulhuUiSubtitle', fontSize: 14, lineHeight: 20 },
      { selector: '.cthulhuUiRowDetailExtra', fontSize: 14, lineHeight: 20 },
      { selector: '.cthulhuUiValuePill', fontSize: 14, lineHeight: 20 },
      { selector: '.cthulhuUiNumericStepperInputNative', fontSize: 14, lineHeight: 20 },
      { selector: '.cthulhuUiNumericStepperInputHelper', fontSize: 12, lineHeight: 16 },
      { selector: '.cthulhuUiSelectorButtonText', fontSize: 14, lineHeight: 20 },
      { selector: '.cthulhuUiSelectorButtonDetail', fontSize: 12, lineHeight: 18 },
      { selector: '.cthulhuUiAccordionLabel', fontSize: 14, lineHeight: 20 },
      { selector: '.cthulhuUiAccordionCount', fontSize: 12, lineHeight: 18 },
      { selector: '.cthulhuUiButton', fontSize: 14, lineHeight: 20 },
      { selector: '.cthulhuUiIconTextButton', fontSize: 14, lineHeight: 16 }
    ]

    for (const sample of samples) {
      const element = gallery.locator(sample.selector).first()
      await expect(element).toBeAttached()
      const actual = await element.evaluate((node) => {
        const style = getComputedStyle(node)
        return { fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) }
      })
      expect(actual.fontSize, sample.selector).toBe(sample.fontSize)
      expect(actual.lineHeight, sample.selector).toBe(sample.lineHeight)
    }
  })

  // Larger folder headings must fit their fixed row, and find text must use its own default scale.
  test('fits standardized folder headings and find text inside their fixed controls', async ({ testSetup }) => {
    // A real workspace exercises feature styles that are absent from the component gallery.
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })
    await testHelpers.navigateToPromptFolders('Development')
    // The heading must leave room for Windows font glyphs beyond the standard line height.
    const title = mainWindow.getByTestId('prompt-folder-root-title')
    await expect(title).toHaveCSS('font-size', '30px')
    await expect(title).toHaveCSS('line-height', '36px')
    // Include padding to detect clipping even when the outer title height stays unchanged.
    const titleMetrics = await title.evaluate((element) => {
      // Read the rendered box rather than relying on class names.
      const style = getComputedStyle(element)
      return {
        available: element.clientHeight,
        scrollHeight: element.scrollHeight,
        required: parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      }
    })
    expect(titleMetrics.required).toBeLessThanOrEqual(titleMetrics.available + 1)
    expect(titleMetrics.scrollHeight).toBeLessThanOrEqual(titleMetrics.available + 1)

    await mainWindow.getByTestId('prompt-folder-find-button').click()
    // The input and match count have different font sizes and must not inherit each other's line height.
    const input = mainWindow.getByTestId('prompt-find-input')
    await expect(input).toBeVisible()
    await expect(input).toHaveCSS('font-size', '14px')
    await expect(input).toHaveCSS('line-height', '20px')
    // The count previously retained a 24px line despite its 12px font.
    const matches = mainWindow.getByTestId('prompt-find-widget').locator('.prompt-find-widget__matches')
    await expect(matches).toHaveCSS('font-size', '12px')
    await expect(matches).toHaveCSS('line-height', '16px')
    // Verify the input's full line and padding fit without vertical text scrolling.
    const inputMetrics = await input.evaluate((element) => ({
      available: element.clientHeight,
      required: element.scrollHeight
    }))
    expect(inputMetrics.required).toBeLessThanOrEqual(inputMetrics.available + 1)
  })
})
