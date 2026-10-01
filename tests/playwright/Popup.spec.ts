import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

/** Electron fixtures exercise the actual shared Popup through its component gallery. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Popup', () => {
  test('positions against the viewport, closes and reopens, and allows background navigation', async ({ testSetup }) => {
    /** Returning user opens the component gallery without a workspace. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await mainWindow.getByTestId('nav-button-test-screen').click()
    /** Shared popup surface with a viewport-relative bottom-left offset. */
    const popup = mainWindow.getByTestId('test-screen-popup')
    await mainWindow.getByTestId('test-screen-open-popup').click()
    await expect(popup).toBeVisible()
    await expect(popup).toHaveAttribute('aria-modal', 'false')
    await expect.poll(() => popup.locator('.cthulhuUiPopupSurface').evaluate((element) => {
      /** Surface bounds must preserve both offsets within one CSS pixel. */
      const bounds = element.getBoundingClientRect()
      return Math.abs(bounds.left - 58) <= 1 && Math.abs(window.innerHeight - bounds.bottom - 10) <= 1
    })).toBe(true)
    await popup.getByRole('button', { name: 'Close popup', exact: true }).click()
    await expect(popup).toHaveCount(0)
    await mainWindow.getByTestId('test-screen-open-popup').click()
    await mainWindow.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
    await mainWindow.getByTestId('test-screen-open-popup').click()
    await testHelpers.navigateToHomeScreen()
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(popup).toHaveCount(0)
  })

  test('tracks anchor scrolling and resizing and preserves position while toggling the backdrop', async ({ electronApp, testSetup }) => {
    /** Real gallery anchor supplies edges that change independently of the popup. */
    const { mainWindow } = await testSetup.setupAndStart()
    await mainWindow.getByTestId('nav-button-test-screen').click()
    /** Anchor stays visible during scrolling so its placement can be compared directly. */
    const anchor = mainWindow.getByTestId('test-screen-popup-anchor')
    await anchor.scrollIntoViewIfNeeded()
    await mainWindow.getByTestId('test-screen-open-anchored-popup').click()
    /** Surface is portalled out of the scroll container but follows the anchor's live edges. */
    const popup = mainWindow.getByTestId('test-screen-popup')
    await expect(popup).toBeVisible()
    /** Reads alignment against the current anchor instead of relying on a stale opening box. */
    const expectAnchored = async (): Promise<void> => {
      await expect.poll(() => mainWindow.evaluate(() => {
        /** Live anchor border box supplies the expected left and bottom edges. */
        const anchorBounds = document.querySelector('[data-testid="test-screen-popup-anchor"]')!.getBoundingClientRect()
        /** Live popup border box includes its overlay border. */
        const popupBounds = document.querySelector('[data-testid="test-screen-popup"] .cthulhuUiPopupSurface')!.getBoundingClientRect()
        return Math.abs(popupBounds.left - anchorBounds.left - 58) <= 1 &&
          Math.abs(anchorBounds.bottom - popupBounds.bottom - 10) <= 1
      })).toBe(true)
    }
    await expectAnchored()
    /** Initial anchor position proves the subsequent scroll actually changes its geometry. */
    const initialTop = (await anchor.boundingBox())!.y
    await mainWindow.locator('.test-screen-shell').evaluate((element) => { element.scrollTop += 24 })
    await expect.poll(async () => Math.abs((await anchor.boundingBox())!.y - initialTop + 24)).toBeLessThanOrEqual(1)
    await expectAnchored()
    await popup.getByTestId('test-screen-popup-toggle-backdrop').click()
    await expect(popup).toHaveAttribute('aria-modal', 'true')
    await expectAnchored()
    /** Content dimensions exercise anchor relayout in the supported Windows environment. */
    const contentSize = await electronApp.evaluate(({ BrowserWindow }) => {
      /** Main window resizes its gallery columns and scroll viewport. */
      const window = BrowserWindow.getAllWindows()[0]!
      window.setContentSize(1000, 800)
      return window.getContentSize()
    })
    await expect.poll(() => mainWindow.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual(contentSize)
    await expectAnchored()
    await popup.getByTestId('test-screen-popup-toggle-backdrop').click()
    await expect(popup).toHaveAttribute('aria-modal', 'false')
    await expectAnchored()
  })

  test('blocks pointer and Tab access with a backdrop and restores interaction when it is disabled', async ({ testSetup }) => {
    /** Gallery controls toggle modality on one mounted popup. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await mainWindow.getByTestId('nav-button-test-screen').click()
    await mainWindow.getByTestId('test-screen-open-popup').click()
    /** Editable content must retain its value and focus across modality changes. */
    const popup = mainWindow.getByTestId('test-screen-popup')
    /** Input demonstrates ordinary typing remains usable inside a blocked application. */
    const input = popup.getByTestId('test-screen-popup-input')
    await input.fill('Retained content')
    await popup.getByTestId('test-screen-popup-toggle-backdrop').click()
    await expect(popup).toHaveAttribute('aria-modal', 'true')
    await expect(input).toHaveValue('Retained content')
    await expect(popup.getByTestId('test-screen-popup-toggle-backdrop')).toBeFocused()
    await input.focus()
    /** Background activity is visible but native modality must reject programmatic focus. */
    const home = mainWindow.getByTestId('nav-button-home')
    await home.focus()
    await expect(input).toBeFocused()
    // More tabs than popup controls exercise wrapping in both directions.
    for (let index = 0; index < 10; index += 1) {
      await mainWindow.keyboard.press(index < 5 ? 'Tab' : 'Shift+Tab')
      expect(await mainWindow.evaluate(() => document.activeElement?.closest('#root') === null)).toBe(true)
    }
    // Disable dismissal so a click aimed at Home proves blocking without closing the popup.
    await popup.getByTestId('test-screen-popup-toggle-closing').click()
    /** Coordinates reproduce a real pointer attempt instead of forcing an inert element click. */
    const homeBounds = (await home.boundingBox())!
    await mainWindow.mouse.click(homeBounds.x + homeBounds.width / 2, homeBounds.y + homeBounds.height / 2)
    await expect(mainWindow.getByTestId('test-screen')).toBeVisible()
    await expect(popup).toBeVisible()
    await popup.getByTestId('test-screen-popup-toggle-backdrop').click()
    await expect(popup).toHaveAttribute('aria-modal', 'false')
    await home.focus()
    await expect(home).toBeFocused()
    await testHelpers.navigateToHomeScreen()
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
  })

  test('gates every user dismissal while allowing parent closure and modal dropdown interaction', async ({ testSetup }) => {
    /** Shared popup and dropdown are mounted inside the actual component gallery. */
    const { mainWindow } = await testSetup.setupAndStart()
    await mainWindow.getByTestId('nav-button-test-screen').click()
    await mainWindow.getByTestId('test-screen-open-popup').click()
    /** Popup remains open while its close controls are locked. */
    const popup = mainWindow.getByTestId('test-screen-popup')
    await popup.getByTestId('test-screen-popup-toggle-backdrop').click()
    await popup.getByRole('button', { name: 'Popup menu', exact: true }).click()
    /** An enabled parent must not also dismiss when its foreground menu consumes Escape. */
    const menu = mainWindow.getByTestId('test-screen-popup-menu')
    await expect(menu).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(popup).toBeVisible()
    await popup.getByTestId('test-screen-popup-toggle-closing').click()
    await expect(popup.getByRole('button', { name: 'Close popup', exact: true })).toBeDisabled()
    await mainWindow.keyboard.press('Escape')
    await expect(popup).toBeVisible()
    await mainWindow.mouse.click(5, 5)
    await expect(popup).toBeVisible()
    await popup.getByRole('button', { name: 'Popup menu', exact: true }).click()
    /** Portalled dropdown must remain interactive inside the modal's native top layer. */
    await expect(menu).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(popup).toBeVisible()
    await popup.getByRole('button', { name: 'Popup menu', exact: true }).click()
    await menu.getByRole('menuitem', { name: 'Open', exact: true }).click()
    await expect(menu).toHaveCount(0)
    await popup.getByTestId('test-screen-popup-parent-close').click()
    await expect(popup).toHaveCount(0)
    await mainWindow.getByTestId('test-screen-open-popup').click()
    await popup.getByTestId('test-screen-popup-toggle-backdrop').click()
    await mainWindow.mouse.click(5, 5)
    await expect(popup).toHaveCount(0)
    await expect(mainWindow.getByTestId('test-screen-open-popup')).toBeFocused()
  })

  test('uses the same background focus blocking and centered placement for Dialog', async ({ testSetup }) => {
    /** Production Welcome dialog verifies the Dialog wrapper, independently of the gallery. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await mainWindow.getByTestId('show-welcome-button').click()
    /** Existing centered dialog must inherit Popup's native interaction blocking. */
    const dialog = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(dialog).toBeVisible()
    await expect.poll(() => dialog.locator('.cthulhuUiPopupSurface').evaluate((element) => {
      /** Centered card bounds preserve the original dialog layout within one CSS pixel. */
      const bounds = element.getBoundingClientRect()
      return Math.abs(bounds.left + bounds.width / 2 - window.innerWidth / 2) <= 1 &&
        Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2) <= 1
    })).toBe(true)
    await mainWindow.getByTestId('nav-button-settings').focus()
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    await mainWindow.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('show-welcome-button')).toBeFocused()
    await testHelpers.navigateToSettingsScreen()
    await expect(mainWindow.getByTestId('settings-screen')).toBeVisible()
  })
})
