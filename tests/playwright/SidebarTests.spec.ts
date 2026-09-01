import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, expect } = createPlaywrightTestSuite()

// Sidebar navigation and state coverage.
test.describe('Sidebar Tests', () => {
  test('home selected on startup and settings enabled', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const activeScreen = await testHelpers.getActiveScreen()
    expect(activeScreen).toBe('home')

    const isHomeActive = await testHelpers.isNavButtonActive('Home')
    expect(isHomeActive).toBe(true)

    const settingsButton = mainWindow.locator('[data-testid="nav-button-settings"]')
    await expect(settingsButton).toBeEnabled()
  })

  test('keeps Home active on startup and when re-clicked', async ({ testSetup }) => {
    const { testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })

    await testHelpers.assertHomeActive()

    await testHelpers.navigateToHomeScreen()
    await testHelpers.assertHomeActive()
  })

  test('allows Settings without a workspace', async ({ electronApp, testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const expectedVersion = await electronApp.evaluate(({ app }) => app.getVersion())

    await testHelpers.assertHomeActive()
    expect(await testHelpers.isWorkspaceReady()).toBe(false)

    const settingsButton = mainWindow.locator('[data-testid="nav-button-settings"]')
    await expect(settingsButton).toBeVisible()
    await expect(settingsButton).toBeEnabled()
    await testHelpers.navigateToSettingsScreen()
    expect(await testHelpers.getActiveScreen()).toBe('settings')

    expect(await testHelpers.isNavButtonActive('Settings')).toBe(true)
    await expect(mainWindow.locator('[data-testid="about-version-display-value"]')).toHaveText(
      `v${expectedVersion}`
    )
  })

  test('allows navigating to Settings after workspace setup', async ({ testSetup }) => {
    const { testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'empty' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.assertHomeActive()

    await testHelpers.navigateToSettingsScreen()
    expect(await testHelpers.getActiveScreen()).toBe('settings')
    expect(await testHelpers.isNavButtonActive('Settings')).toBe(true)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.assertHomeActive()
  })

  test('toggles the sidebar from the Windows title bar without hiding the activity bar', async ({
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    // The left title-bar action region aligns the app icon and control with the activity-bar edge.
    const titleBarActions = mainWindow.locator('.titlebar__actions')
    // The title-bar app icon reuses the application artwork at the requested compact size.
    const titleBarAppIcon = titleBarActions.locator('.titlebar__app-icon')
    // The title-bar control exposes the current action and swaps its directional icon.
    const toggleButton = titleBarActions.locator('[data-testid="app-sidebar-toggle-button"]')
    // These surfaces distinguish the collapsible sidebar from persistent primary navigation.
    const sidebar = mainWindow.locator('.appSidebar')
    const activityBar = mainWindow.locator('[data-testid="app-activity-bar"]')
    // The inactive activity button provides the toggle's default glyph color.
    const inactiveActivityButton = mainWindow.locator('[data-testid="nav-button-settings"]')
    // The pane is the layout element removed instantly when the sidebar is collapsed.
    const sidebarPane = mainWindow.locator('.resizableSidebarPane')
    // The sidebar frame owns its right separator so the border disappears with the pane.
    const sidebarFrame = sidebarPane.locator('.sidebarFrameBorder')
    // The main surface should immediately consume the space released by the sidebar pane.
    const mainSurface = mainWindow.locator('.mainScreenSurface')
    // Title-bar geometry verifies the compact button's vertical two-pixel inset.
    const titleBarActionsBox = (await titleBarActions.boundingBox())!
    // The rendered image box verifies the requested icon size and top-left inset.
    const titleBarAppIconBox = (await titleBarAppIcon.boundingBox())!
    const toggleButtonBox = (await toggleButton.boundingBox())!
    // Expanded geometry is the exact layout that must be restored after reopening.
    const expandedSidebarPaneBox = (await sidebarPane.boundingBox())!
    const expandedMainSurfaceBox = (await mainSurface.boundingBox())!
    const activityBarBox = (await activityBar.boundingBox())!
    // Motion styles guard the pane against CSS transitions or animations during either toggle.
    const sidebarPaneMotion = await sidebarPane.evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        transitionDuration: styles.transitionDuration,
        animationName: styles.animationName
      }
    })
    // Effective hit testing proves the button remains clickable inside the draggable title bar.
    const toggleAppRegion = await toggleButton.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('-webkit-app-region')
    )
    // The default activity color and hover palette token verify the toggle's two glyph states.
    const inactiveActivityColor = await inactiveActivityButton.evaluate(
      (element) => getComputedStyle(element).color
    )
    const hoverableIconColor = await toggleButton.evaluate((element) => {
      // Temporary glyph resolves the custom palette property to the browser's computed format.
      const colorProbe = document.createElement('span')
      colorProbe.style.color = 'var(--ui-hoverable-icon-glyph)'
      element.append(colorProbe)
      // Computed probe color matches the serialization used by the hovered button.
      const computedColor = getComputedStyle(colorProbe).color
      colorProbe.remove()
      return computedColor
    })

    expect(titleBarAppIconBox.width).toBe(16)
    expect(titleBarAppIconBox.height).toBe(16)
    expect(Math.abs(titleBarAppIconBox.x - (titleBarActionsBox.x + 10))).toBeLessThanOrEqual(1)
    expect(Math.abs(titleBarAppIconBox.y - (titleBarActionsBox.y + 8))).toBeLessThanOrEqual(1)
    expect(
      Math.abs(toggleButtonBox.x - (activityBarBox.x + activityBarBox.width))
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(toggleButtonBox.y - (titleBarActionsBox.y + 2))).toBeLessThanOrEqual(1)
    expect(sidebarPaneMotion).toEqual({ transitionDuration: '0s', animationName: 'none' })
    expect(toggleAppRegion).toBe('no-drag')

    await expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar')
    await expect(titleBarAppIcon).toHaveAttribute('alt', 'Cthulhu Prompt icon')
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    await expect(toggleButton.locator('[data-testid="app-sidebar-close-icon"]')).toBeVisible()
    await expect(toggleButton).toHaveCSS('border-top-style', 'none')
    await expect(toggleButton).toHaveCSS('color', inactiveActivityColor)
    await expect(sidebarFrame).toHaveCSS('border-right-width', '1px')
    await expect(mainSurface).toHaveCSS('border-left-width', '0px')
    await expect(sidebar).toBeVisible()
    await expect(activityBar).toBeVisible()

    await toggleButton.hover()
    await expect
      .poll(() => toggleButton.evaluate((element) => getComputedStyle(element).color))
      .toBe(hoverableIconColor)

    await toggleButton.click()
    // Collapsed geometry is sampled before any visibility assertion can wait for motion to finish.
    const collapsedSidebarPaneBox = await sidebarPane.boundingBox()
    const collapsedMainSurfaceBox = (await mainSurface.boundingBox())!

    expect(collapsedSidebarPaneBox).toBeNull()
    expect(
      Math.abs(collapsedMainSurfaceBox.x - (activityBarBox.x + activityBarBox.width))
    ).toBeLessThanOrEqual(1)
    await expect(toggleButton).toHaveAttribute('aria-label', 'Expand sidebar')
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    await expect(toggleButton.locator('[data-testid="app-sidebar-open-icon"]')).toBeVisible()
    await expect(sidebar).toBeHidden()
    await expect(mainWindow.locator('[data-testid="app-sidebar-resize-handle"]')).toBeHidden()
    await expect(activityBar).toBeVisible()
    await expect(activityBar).toHaveCSS('border-right-width', '1px')

    await toggleButton.click()
    // Restored geometry is sampled immediately so an in-progress width animation would fail.
    const restoredSidebarPaneBox = (await sidebarPane.boundingBox())!
    const restoredMainSurfaceBox = (await mainSurface.boundingBox())!

    expect(Math.abs(restoredSidebarPaneBox.width - expandedSidebarPaneBox.width)).toBeLessThanOrEqual(
      1
    )
    expect(Math.abs(restoredMainSurfaceBox.x - expandedMainSurfaceBox.x)).toBeLessThanOrEqual(1)
    await expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar')
    await expect(sidebar).toBeVisible()
    await expect(mainWindow.locator('[data-testid="app-sidebar-resize-handle"]')).toBeVisible()
    await expect(activityBar).toBeVisible()
  })
})
