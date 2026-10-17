import { resolvePaletteColor } from '../helpers/PaletteHelpers'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

/** Real gallery controls exercise the shared CSS and native browser interactions. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Shared button behavior', () => {
  test('preserves button dimensions and keyboard focus feedback', async ({ testSetup }) => {
    /** The gallery exposes the public components without feature-specific sizing overrides. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.clickNavButton('Test Screen')
    /** Palette foreground and focus colors remain the same after sharing the CSS. */
    const gallery = mainWindow.getByTestId('test-screen')
    /** Focus borders must use the existing palette rather than browser defaults. */
    const focusBorder = await resolvePaletteColor(gallery, '--ui-neutral-focus-border')
    /** Interacted text and glyphs brighten to the existing full-white foreground. */
    const foreground = await resolvePaletteColor(gallery, '--ui-normal-text')

    // Fixed heights protect layout and virtualization from a common-base sizing regression.
    for (const [testId, height] of [
      ['test-screen-neutral-button', 40],
      ['test-screen-outline-button', 40],
      ['test-screen-link-button', 40],
      ['test-screen-neutral-icon-text-button', 30],
      ['test-screen-toggle-text-button', 40]
    ] as const) {
      /** Each public text-bearing button keeps its existing dimensions and focus treatment. */
      const button = mainWindow.getByTestId(testId)
      await expect(button).toHaveCSS('height', `${height}px`)
      await button.focus()
      await mainWindow.keyboard.press('Tab')
      await mainWindow.keyboard.press('Shift+Tab')
      await expect(button).toBeFocused()
      await expect(button).toHaveCSS('outline-width', '2px')
      await expect(button).toHaveCSS('outline-color', focusBorder)
      await expect(button).toHaveCSS('color', foreground)
      await expect(button).toHaveCSS('height', `${height}px`)
    }

    // Icon-button sizes include the intentionally rectangular title-edit control.
    for (const [size, width, height, iconSize] of [
      ['default', 36, 36, 20],
      ['compact', 28, 28, 16],
      ['compact-large-icon', 36, 28, 20],
      ['tiny', 18, 18, 14]
    ] as const) {
      /** The named gallery sample uses the default palette at this size. */
      const button = mainWindow.getByRole('button', { name: `normal neutral ${size}`, exact: true })
      await expect(button).toHaveCSS('width', `${width}px`)
      await expect(button).toHaveCSS('height', `${height}px`)
      await expect(button.locator('svg')).toHaveCSS('width', `${iconSize}px`)
      await button.hover()
      await expect(button).toHaveCSS('color', foreground)
      await expect(button).toHaveCSS('width', `${width}px`)
    }

    // Lower-emphasis icons must still brighten; scoped idle colors must not override shared hover.
    for (const variant of ['dim', 'muted']) {
      /** Idle foreground variants share the same interacted foreground. */
      const button = mainWindow.getByRole('button', { name: `${variant} neutral default`, exact: true })
      await button.hover()
      await expect(button).toHaveCSS('color', foreground)
    }
  })

  test('disables activation and tab access, then restores buttons and links reactively', async ({ testSetup }) => {
    /** Live props are changed through the gallery rather than modifying the DOM under test. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.clickNavButton('Test Screen')
    /** Consecutive controls make skipped keyboard tab stops observable. */
    const samples = mainWindow.getByTestId('test-screen-button-interaction')
    /** Every native button, including both split actions and the selector, starts disabled. */
    const buttons = samples.locator('button')
    await expect(buttons).toHaveCount(7)
    for (const button of await buttons.all()) {
      await expect(button).toBeDisabled()
      await expect(button).toHaveCSS('opacity', '0.5')
    }
    await buttons.evaluateAll((elements) => elements.forEach((element) => (element as HTMLButtonElement).click()))
    await expect(mainWindow.getByTestId('test-screen-button-activations')).toHaveText('0')
    await expect(mainWindow.getByRole('menu')).toHaveCount(0)

    /** Disabled anchors must not retain a destination even for programmatic activation. */
    const link = mainWindow.getByTestId('test-screen-disable-link')
    /** Current document address detects accidental disabled-link navigation. */
    const initialUrl = mainWindow.url()
    await expect(link).toHaveRole('link')
    await expect(link).toHaveAttribute('aria-disabled', 'true')
    await expect(link).toHaveAttribute('tabindex', '-1')
    await expect(link).not.toHaveAttribute('href')
    await link.evaluate((element) => (element as HTMLAnchorElement).click())
    await expect(mainWindow).toHaveURL(initialUrl)
    await mainWindow.getByTestId('test-screen-toggle-button-disabled').focus()
    await mainWindow.keyboard.press('Tab')
    await expect(mainWindow.getByTestId('test-screen-button-focus-target')).toBeFocused()

    await mainWindow.getByTestId('test-screen-toggle-button-disabled').click()
    for (const button of await buttons.all()) await expect(button).toBeEnabled()
    for (const name of ['action', 'icon', 'toolbar', 'toggle', 'split']) {
      await mainWindow.getByTestId(`test-screen-disable-${name}`).click()
    }
    await expect(mainWindow.getByTestId('test-screen-button-activations')).toHaveText('5')
    await expect(link).toHaveAttribute('href', '#action-buttons')
    await expect(link).not.toHaveAttribute('aria-disabled')
    await expect(link).not.toHaveAttribute('tabindex')
    await mainWindow.getByTestId('test-screen-disable-toolbar').focus()
    await mainWindow.keyboard.press('Tab')
    await expect(link).toBeFocused()
    await mainWindow.keyboard.press('Enter')
    await expect(mainWindow).toHaveURL(/#action-buttons$/)

    await mainWindow.getByTestId('test-screen-toggle-button-disabled').click()
    for (const button of await buttons.all()) await expect(button).toBeDisabled()
    await expect(link).not.toHaveAttribute('href')
  })

  test('preserves pressed and hover icons without changing toolbar geometry', async ({ testSetup }) => {
    /** Controlled gallery toggle reproduces the icon-swap states used by toolbar actions. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.clickNavButton('Test Screen')
    /** Pressed toggle starts with Check, changes to X on interaction, and returns to Plus when off. */
    const button = mainWindow.getByTestId('test-screen-toggle-icon-text-button')
    await button.scrollIntoViewIfNeeded()
    await mainWindow.mouse.move(0, 0)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button.locator('svg.lucide-check')).toBeVisible()
    await expect(button.locator('svg.lucide-x')).toBeHidden()
    /** Original box catches layout movement from the alternate icon slot. */
    const original = await button.boundingBox()
    await button.hover()
    await expect(button.locator('svg.lucide-check')).toBeHidden()
    await expect(button.locator('svg.lucide-x')).toBeVisible()
    /** Hovered dimensions may differ by at most one CSS pixel. */
    const hovered = await button.boundingBox()
    expect(Math.abs(hovered!.width - original!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(hovered!.height - original!.height)).toBeLessThanOrEqual(1)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(button.locator('svg.lucide-plus')).toBeVisible()
    await expect(button.locator('svg.lucide-x')).toHaveCount(0)
    await button.click()
    await mainWindow.mouse.move(0, 0)
    await button.focus()
    await mainWindow.keyboard.press('Tab')
    await mainWindow.keyboard.press('Shift+Tab')
    await expect(button).toBeFocused()
    await expect(button.locator('svg.lucide-x')).toBeVisible()
    await expect(button.locator('svg.lucide-check')).toBeHidden()
  })
})
