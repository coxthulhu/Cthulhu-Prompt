import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, expect } = createPlaywrightTestSuite()

// Sidebar navigation and state coverage.
test.describe('Sidebar Tests', () => {
  // Each finalized group must reopen expanded after its saved state was collapsed.
  for (const groupId of ['completed', 'archived']) {
    test(`shows ${groupId} expanded at its previous resized height`, async ({ testSetup }) => {
      /** Workspace with a selectable prompt folder and the real sidebar accordion. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'sample' }
      })
      await testHelpers.navigateToPromptFolders('Development')

      /** Toolbar control that removes and remounts this section. */
      const toggle = mainWindow.getByTestId(`toggle-${groupId}-prompts-button`)
      /** Section whose expanded height must survive hiding and showing. */
      const section = mainWindow.getByTestId(`sidebar-prompt-status-accordion-section-${groupId}`)
      /** Header used to persist a collapsed state before hiding the section. */
      const header = mainWindow.getByTestId(`sidebar-prompt-status-accordion-header-${groupId}`)
      await expect(section).toHaveCount(0)
      await toggle.click()
      await expect(header).toHaveAttribute('aria-expanded', 'true')

      /** Initial height distinguishes restoration from resetting the section's sizing. */
      const initialHeightPx = (await section.boundingBox())!.height
      /** Active's top sash resizes the finalized section immediately above it. */
      const sashBox = (await mainWindow
        .getByTestId('sidebar-prompt-status-accordion-sash-active')
        .boundingBox())!
      await mainWindow.mouse.move(sashBox.x + sashBox.width / 2, sashBox.y + sashBox.height / 2)
      await mainWindow.mouse.down()
      await mainWindow.mouse.move(sashBox.x + sashBox.width / 2, sashBox.y + sashBox.height / 2 + 40)
      await mainWindow.mouse.up()
      await expect.poll(async () => Math.abs((await section.boundingBox())!.height - initialHeightPx - 40))
        .toBeLessThanOrEqual(2)
      /** User-resized height restored when the surrounding layout is unchanged. */
      const resizedHeightPx = (await section.boundingBox())!.height

      await header.click()
      await expect(header).toHaveAttribute('aria-expanded', 'false')
      await toggle.click()
      await expect(section).toHaveCount(0)
      await toggle.click()
      await expect(header).toHaveAttribute('aria-expanded', 'true')
      await expect.poll(async () => Math.abs((await section.boundingBox())!.height - resizedHeightPx))
        .toBeLessThanOrEqual(2)

      // Hiding an already expanded section must preserve the same sizing too.
      await toggle.click()
      await expect(section).toHaveCount(0)
      await toggle.click()
      await expect(header).toHaveAttribute('aria-expanded', 'true')
      await expect.poll(async () => Math.abs((await section.boundingBox())!.height - resizedHeightPx))
        .toBeLessThanOrEqual(2)
    })
  }

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

    expect(workspaceSetupResult!.workspaceReady).toBe(true)
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')

    await testHelpers.navigateToSettingsScreen()
    expect(await testHelpers.getActiveScreen()).toBe('settings')
    expect(await testHelpers.isNavButtonActive('Settings')).toBe(true)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.assertHomeActive()
  })

  test('toggles the sidebar from the active activity and opens it when switching activities', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await testHelpers.navigateToPromptFolders('Development')
    const selectedPrompt = mainWindow.getByTestId('prompt-tree-active-prompt-dev-1')
    await selectedPrompt.click()
    await expect(selectedPrompt).toHaveAttribute('aria-current', 'true')

    const activityBar = mainWindow.getByTestId('app-activity-bar')
    const activity = mainWindow.getByTestId('nav-button-prompt-task-folders')
    const sidebar = mainWindow.getByTestId('app-sidebar')
    const sidebarPane = mainWindow.locator('.resizableSidebarPane')
    const mainSurface = mainWindow.locator('.mainScreenSurface')
    const titleBarAppIcon = mainWindow.locator('.titlebar__app-icon')
    const expandedSidebarPaneBox = (await sidebarPane.boundingBox())!
    const expandedMainSurfaceBox = (await mainSurface.boundingBox())!
    const activityBarBox = (await activityBar.boundingBox())!
    const activeIconColor = await activity.evaluate((element) => getComputedStyle(element).color)
    const folderTitle = mainWindow.getByTestId('prompt-folder-root-title')
    const selectedFolderTitle = await folderTitle.textContent()
    const readIndicator = () => activity.evaluate((element) => {
      const styles = getComputedStyle(element, '::before')
      return { height: styles.height, width: styles.width }
    })

    await expect(mainWindow.getByTestId('app-sidebar-toggle-button')).toHaveCount(0)
    await expect(titleBarAppIcon).toHaveAttribute('alt', 'Cthulhu Prompt icon')
    await expect(titleBarAppIcon).toHaveCSS('width', '16px')
    await expect(titleBarAppIcon).toHaveCSS('height', '16px')
    await expect(activity).toHaveAttribute('aria-current', 'page')
    await expect(activity).toHaveAttribute('aria-expanded', 'true')
    await expect(activity).toHaveAttribute('title', 'Task Prompts — Hide sidebar')
    expect(await readIndicator()).toEqual({ height: '36px', width: '2px' })
    await expect(sidebarPane).toHaveCSS('transition-duration', '0s')
    await expect(sidebarPane).toHaveCSS('animation-name', 'none')

    await activity.click()
    // Sample geometry immediately to catch unwanted collapse animations.
    const collapsedSidebarPaneBox = await sidebarPane.boundingBox()
    const collapsedMainSurfaceBox = (await mainSurface.boundingBox())!
    expect(collapsedSidebarPaneBox).toBeNull()
    expect(
      Math.abs(collapsedMainSurfaceBox.x - (activityBarBox.x + activityBarBox.width))
    ).toBeLessThanOrEqual(1)
    await expect(sidebar).toBeHidden()
    await expect(mainWindow.getByTestId('app-sidebar-resize-handle')).toBeHidden()
    await expect(activityBar).toBeVisible()
    await expect(activity).toHaveAttribute('aria-current', 'page')
    await expect(activity).toHaveAttribute('aria-expanded', 'false')
    await expect(activity).toHaveAttribute('title', 'Task Prompts — Show sidebar')
    await expect(activity).toHaveCSS('color', activeIconColor)
    await expect(folderTitle).toHaveText(selectedFolderTitle!)
    expect(await readIndicator()).toEqual({ height: '28px', width: '2px' })

    // Keyboard activation restores the sidebar without navigating away from the prompt.
    await activity.press('Enter')
    const restoredSidebarPaneBox = (await sidebarPane.boundingBox())!
    const restoredMainSurfaceBox = (await mainSurface.boundingBox())!
    expect(Math.abs(restoredSidebarPaneBox.width - expandedSidebarPaneBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(restoredMainSurfaceBox.x - expandedMainSurfaceBox.x)).toBeLessThanOrEqual(1)
    await expect(activity).toHaveAttribute('aria-expanded', 'true')
    await expect(selectedPrompt).toHaveAttribute('aria-current', 'true')
    await expect(folderTitle).toHaveText(selectedFolderTitle!)
    await expect(mainWindow.getByTestId('app-sidebar-resize-handle')).toBeVisible()
    expect(await readIndicator()).toEqual({ height: '36px', width: '2px' })

    await activity.press('Space')
    await expect(sidebar).toBeHidden()
    // Every primary screen opens its sidebar on navigation and toggles on a repeat click.
    for (const screen of ['settings', 'home', 'prompt-template-folders', 'prompt-task-folders']) {
      const nextActivity = mainWindow.getByTestId(`nav-button-${screen}`)
      await nextActivity.click()
      await expect(nextActivity).toHaveAttribute('aria-current', 'page')
      await expect(nextActivity).toHaveAttribute('aria-expanded', 'true')
      await expect(sidebar).toBeVisible()
      await expect(activityBar.locator('[aria-current="page"]')).toHaveCount(1)
      await nextActivity.click()
      await expect(nextActivity).toHaveAttribute('aria-current', 'page')
      await expect(nextActivity).toHaveAttribute('aria-expanded', 'false')
      await expect(sidebar).toBeHidden()
      await expect(activityBar).toBeVisible()
    }
  })
})
