import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { readWorkspaceState, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'

const { test, expect } = createPlaywrightTestSuite()

// Sidebar navigation and state coverage.
test.describe('Sidebar Tests', () => {
  // Each finalized group must reopen expanded after its saved state was collapsed.
  for (const groupId of ['completed', 'archived']) {
    test(`shows ${groupId} expanded at its previous resized height`, async ({ testSetup }) => {
      /** Workspace with a selectable prompt collection and the real sidebar accordion. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'sample' }
      })
      await testHelpers.navigateToPromptCollections('Development')

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

  // Screens without a sidebar stay collapsed even when their activity is activated again.
  test('keeps screens without a sidebar collapsed across activity switches and repeated clicks', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    const sidebar = mainWindow.getByTestId('app-sidebar')
    await expect(sidebar).toHaveCount(0)
    await expect(mainWindow.locator('.resizableSidebarPane')).toBeHidden()

    for (const screen of ['home', 'mockups', 'test-screen']) {
      await testHelpers.navigateToPromptCollections('Development')
      await expect(sidebar).toBeVisible()
      const activity = mainWindow.getByTestId(`nav-button-${screen}`)
      await activity.click()
      await expect(sidebar).toHaveCount(0)
      await expect(mainWindow.locator('.resizableSidebarPane')).toBeHidden()
      await expect(mainWindow.getByTestId('app-sidebar-resize-handle')).toBeHidden()
      await expect(activity).not.toHaveAttribute('aria-expanded')
      await expect(activity).not.toHaveAttribute('title', /sidebar/)
      await activity.click()
      await activity.press('Enter')
      await expect(sidebar).toHaveCount(0)
      await expect(mainWindow.locator('.resizableSidebarPane')).toBeHidden()
    }
  })

  // Each collection mode restores its own collection and status view after other modes are displayed.
  test('restores the project collection selection across activity switches', async ({ testSetup }) => {
    /** Workspace with distinct task and template collection names. */
    const path = '/ws/sidebar-modes'
    await testSetup.setupFilesystem({
      ...createWorkspaceWithCollections(path, ['Alpha', 'Beta'].map((name) => (
        { folderName: name, displayName: name, promptCollectionId: `prompt-${name}` }
      ))),
      ...createWorkspaceWithTemplateCollections(path, ['Gamma', 'Delta'].map((name) => (
        { folderName: name, displayName: name, collectionId: `template-${name}` }
      )))
    })
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    /** Shared header title identifying the displayed sidebar mode. */
    const sidebarTitle = mainWindow.getByTestId('sidebar-title')
    /** Collection screen title identifying the displayed collection. */
    const collectionTitle = mainWindow.getByTestId('prompt-collection-title')

    await testHelpers.navigateToPromptCollections('Beta')
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-archived-filter')).toHaveAttribute('aria-pressed', 'true')
    await testHelpers.navigateToPromptCollections('Delta')
    await expect(sidebarTitle).toHaveText('Default Project')
    await expect(collectionTitle).toHaveText('Delta')
    await expect(mainWindow.getByTestId('prompt-collection-active-filter')).toHaveAttribute('aria-pressed', 'true')

    // The project reopens its last collection of either kind, and each collection keeps its status mode.
    await testHelpers.navigateToHomeScreen()
    await expect(sidebarTitle).toHaveCount(0)
    await mainWindow.getByTestId('nav-button-project').click()
    await expect(sidebarTitle).toHaveText('Default Project')
    await expect(collectionTitle).toHaveText('Delta')
    await expect(mainWindow.getByTestId('prompt-collection-active-filter')).toHaveAttribute('aria-pressed', 'true')
    await testHelpers.navigateToPromptCollections('Beta')
    await expect(collectionTitle).toHaveText('Beta')
    await expect(mainWindow.getByTestId('prompt-collection-archived-filter')).toHaveAttribute('aria-pressed', 'true')
  })

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

  // The title bar icon is plain decoration; the Test Screen button carries the rotating tooltip.
  test('shows the title bar app icon and rotates the Test Screen tooltip on hover', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    /** App icon at the start of the title bar. */
    const appIcon = mainWindow.locator('.titlebar__app-icon')
    /** Test Screen button whose tooltip changes on every hover. */
    const testScreenButton = mainWindow.getByTestId('nav-button-test-screen')

    await expect(appIcon).toHaveAttribute('alt', 'Cthulhu Prompt icon')
    await expect(appIcon).not.toHaveAttribute('title')
    await expect(appIcon).toHaveCSS('width', '20px')
    await expect(appIcon).toHaveCSS('height', '20px')
    await expect(mainWindow.getByTestId('activity-bar-mascot')).toHaveCount(0)
    await expect(mainWindow.locator('.titlebar')).toHaveCSS('height', '44px')
    // Screen and update buttons moved out of the activity bar into the title bar.
    for (const testId of ['nav-button-home', 'nav-button-settings', 'nav-button-mockups', 'nav-button-test-screen', 'app-updates-button']) {
      await expect(mainWindow.locator(`.titlebar [data-testid="${testId}"]`)).toBeVisible()
      await expect(mainWindow.getByTestId('app-activity-bar').getByTestId(testId)).toHaveCount(0)
    }

    /** Tooltip shown before the hover replaces it. */
    const tooltip = await testScreenButton.getAttribute('title')
    await testScreenButton.hover()
    await expect(testScreenButton).not.toHaveAttribute('title', tooltip!)
    await expect(testScreenButton).toHaveAttribute('aria-label', 'Test Screen')
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

    expect(await testHelpers.isNavButtonActive('System Settings')).toBe(true)
    await expect(mainWindow.locator('[data-testid="about-version-display-value"]')).toHaveText(
      `v${expectedVersion}`
    )
  })

  test('allows navigating to Settings after workspace setup', async ({ testSetup }) => {
    const { testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'empty' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)
    expect(await testHelpers.getActiveScreen()).toBe('prompt-collection')

    await testHelpers.navigateToSettingsScreen()
    expect(await testHelpers.getActiveScreen()).toBe('settings')
    expect(await testHelpers.isNavButtonActive('System Settings')).toBe(true)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.assertHomeActive()
  })

  // Repeated activity clicks never hide the sidebar, while switching activities still forces it open.
  test('keeps the sidebar open on repeated activity clicks and opens it when switching activities', async ({
    electronApp,
    testSetup
  }) => {
    // A saved collapsed preference proves that switching activities overrides it.
    await seedWorkspaceState(electronApp, null, 'application-user', null, {
      hasShownWelcome: true,
      appSidebarExpanded: false
    })
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    /** Sidebar shared by both sidebar activities. */
    const sidebar = mainWindow.getByTestId('app-sidebar')
    /** Sash shown only while the sidebar is expanded. */
    const resizeHandle = mainWindow.getByTestId('app-sidebar-resize-handle')
    /** Reads whether the title bar's Enter/Space handler maximized the window. */
    const isMaximized = () => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized())
    /** Window state that keyboard presses on title bar buttons must not change. */
    const initiallyMaximized = await isMaximized()
    await expect(sidebar).toHaveCount(0)
    expect((await readWorkspaceState(electronApp, null, 'application-user', null))?.appSidebarExpanded).toBe(false)

    for (const screen of ['settings', 'project']) {
      /** Activity whose screen shows a sidebar. */
      const activity = mainWindow.getByTestId(`nav-button-${screen}`)
      // Keyboard activation reaches the title bar's Settings button instead of maximizing the window.
      await activity.press('Enter')
      await expect(activity).toHaveAttribute('aria-current', 'page')
      await expect(sidebar).toBeVisible()
      await expect(resizeHandle).toBeVisible()
      await expect(mainWindow.locator('[aria-current="page"][data-testid^="nav-button-"]')).toHaveCount(1)
      await expect(activity).not.toHaveAttribute('aria-expanded')
      await expect(activity).not.toHaveAttribute('title', /sidebar/)

      // Pointer and keyboard repeats leave the screen and its sidebar unchanged.
      await activity.click()
      await activity.press('Enter')
      await activity.press('Space')
      await expect(activity).toHaveAttribute('aria-current', 'page')
      await expect(sidebar).toBeVisible()
      await expect(resizeHandle).toBeVisible()
      expect(await isMaximized()).toBe(initiallyMaximized)
    }
    await expect.poll(async () =>
      (await readWorkspaceState(electronApp, null, 'application-user', null))?.appSidebarExpanded
    ).toBe(true)

    // Re-clicking the active project keeps its selected collection and prompt.
    await testHelpers.navigateToPromptCollections('Development')
    /** Prompt selected before the repeated click. */
    const selectedPrompt = mainWindow.getByTestId('prompt-tree-active-prompt-dev-1')
    await selectedPrompt.click()
    await expect(selectedPrompt).toHaveAttribute('aria-current', 'true')
    /** Collection title that must survive the repeated click. */
    const collectionTitle = mainWindow.getByTestId('prompt-collection-title')
    const selectedCollectionTitle = await collectionTitle.textContent()
    await mainWindow.getByTestId('nav-button-project').click()
    await expect(selectedPrompt).toHaveAttribute('aria-current', 'true')
    await expect(collectionTitle).toHaveText(selectedCollectionTitle!)
    await expect(sidebar).toBeVisible()
  })
})
