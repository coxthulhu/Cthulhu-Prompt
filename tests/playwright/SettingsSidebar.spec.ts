import type { Page } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { readUserPersistence } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

/** Settings screen scroll container. */
const SETTINGS_SCREEN_SELECTOR = '[data-testid="settings-screen"]'

/** Returns a target's vertical position within the settings viewport. */
const getSettingsTargetPosition = async (mainWindow: Page, targetTestId: string) =>
  await mainWindow.evaluate(
    ({ screenSelector, testId }) => {
      const screen = document.querySelector<HTMLElement>(screenSelector)!
      const screenRect = screen.getBoundingClientRect()
      const targetRect = screen.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect()
      return {
        /** Target top relative to the viewport top. */
        topOffsetPx: targetRect.top - screenRect.top,
        /** Target midpoint relative to the viewport midpoint. */
        centerOffsetPx: targetRect.top + targetRect.height / 2 - (screenRect.top + screen.clientHeight / 2)
      }
    },
    { screenSelector: SETTINGS_SCREEN_SELECTOR, testId: targetTestId }
  )

/** Reads the settings screen's DOM scroll offset. */
const getSettingsScrollTop = async (mainWindow: Page): Promise<number> =>
  await mainWindow
    .locator(SETTINGS_SCREEN_SELECTOR)
    .evaluate((element) => Math.round(element.scrollTop))

/** Waits two frames so pending scroll events and mount-time restoration have been handled. */
const waitForScrollHandling = async (mainWindow: Page): Promise<void> => {
  await mainWindow.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  )
}

describe('Settings Sidebar', () => {
  test('lists every settings section and row with all sections expanded', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    await testHelpers.navigateToSettingsScreen()

    await expect(mainWindow.getByTestId('settings-sidebar-title')).toHaveText('System Settings')
    await expect(mainWindow.getByTestId('sidebar-collection-title')).toHaveCount(0)
    const tree = mainWindow.getByTestId('settings-tree')
    await expect(tree.locator('[aria-expanded]')).toHaveText(['Editor & Layout', 'About'])
    await expect(tree.locator('[aria-expanded="true"]')).toHaveCount(2)
    await expect(tree.locator('[data-testid^="settings-tree-row-"]')).toHaveText([
      'Font Size',
      'New Prompt Focus',
      'Minimum Line Count',
      'Maximum Line Count',
      'Attached Note Maximum Lines',
      'Show Line Numbers',
      'Report an Issue',
      'Automatic Updates',
      'Current Version'
    ])
    await expect(tree.locator('[aria-current="true"]')).toHaveCount(0)
    await expect(tree.locator('[data-row-state="active"]')).toHaveCount(0)
  })

  test('centers a clicked setting and keeps it highlighted until the user scrolls', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    await testHelpers.navigateToSettingsScreen()

    const row = mainWindow.getByTestId('settings-tree-row-automatic-updates')
    await row.click()
    await expect(row).toHaveAttribute('aria-current', 'true')
    await expect
      .poll(async () =>
        Math.abs((await getSettingsTargetPosition(mainWindow, 'about-automatic-updates-row')).centerOffsetPx)
      )
      .toBeLessThanOrEqual(2)

    // Programmatic scrolling must not clear the highlight; a user scroll must.
    await waitForScrollHandling(mainWindow)
    await expect(row).toHaveAttribute('aria-current', 'true')
    await mainWindow.locator(SETTINGS_SCREEN_SELECTOR).hover()
    await mainWindow.mouse.wheel(0, 100)
    await expect(row).not.toHaveAttribute('aria-current', 'true')
  })

  test('opens a section from its context menu at the section top offset', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    await testHelpers.navigateToSettingsScreen()

    const sectionToggle = mainWindow.getByTestId('prompt-tree-settings-category-toggle-button-About')
    await sectionToggle.click({ button: 'right' })
    await expect(mainWindow.getByTestId('prompt-tree-settings-category-settings-menu-item-About')).toHaveCount(0)
    const openItem = mainWindow.getByTestId('prompt-tree-settings-category-open-menu-item-About')
    await expect(openItem).toHaveText('Open Section')
    await openItem.click()

    await expect
      .poll(async () =>
        Math.abs((await getSettingsTargetPosition(mainWindow, 'settings-section-about')).topOffsetPx - 80)
      )
      .toBeLessThanOrEqual(2)
    await waitForScrollHandling(mainWindow)
    await expect(sectionToggle.locator('xpath=..')).toHaveAttribute('data-row-state', 'active')
    await expect(sectionToggle).toHaveAttribute('aria-expanded', 'true')
  })

  test('persists collapsed sections and scroll position across screen switches and restarts', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    await testHelpers.navigateToSettingsScreen()

    const aboutToggle = mainWindow.getByTestId('prompt-tree-settings-category-toggle-button-About')
    const aboutRow = mainWindow.getByTestId('settings-tree-row-current-version')
    await aboutToggle.click()
    await expect(aboutRow).toHaveCount(0)
    await waitForScrollHandling(mainWindow)
    await mainWindow.locator(SETTINGS_SCREEN_SELECTOR).evaluate((element) => {
      element.scrollTop = 200
    })
    await expect.poll(async () => getSettingsScrollTop(mainWindow)).toBe(200)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToSettingsScreen()
    await expect(aboutToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(aboutRow).toHaveCount(0)
    await expect.poll(async () => getSettingsScrollTop(mainWindow)).toBe(200)

    await expect
      .poll(async () => {
        const persisted = await readUserPersistence(electronApp)
        return [persisted.settingsCollapsedSectionIds, persisted.settingsScrollTopPx]
      })
      .toEqual([['about'], 200])
    await mainWindow.reload()
    await expect(mainWindow.locator(SETTINGS_SCREEN_SELECTOR)).toBeVisible()
    await expect(mainWindow.locator('[data-testid="startup-loading-overlay"]')).toHaveCount(0)
    await expect(aboutToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(aboutRow).toHaveCount(0)
    await expect(mainWindow.getByTestId('prompt-tree-settings-category-toggle-button-Editor&Layout'))
      .toHaveAttribute('aria-expanded', 'true')
    await expect.poll(async () => getSettingsScrollTop(mainWindow)).toBe(200)
  })
})
