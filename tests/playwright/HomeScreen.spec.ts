import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { stubClipboard } from '../helpers/ClipboardHelpers'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { checkFileExists } from '../helpers/PromptPersistenceTestHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const workspaceFolderOrderPath = (workspacePath: string): string =>
  `${workspacePath}/WorkspaceFolderOrder.json`

describe('Home Screen', () => {
  test('shows the get started state on launch without a workspace', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    // Confirm the app rendered the home screen before checking state.
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="create-workspace-button"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="sidebar-workspace-subtitle"]')).toHaveText(
      'Select a Workspace to Get Started'
    )
    await expect(mainWindow.locator('.sidebarPromptTreeStatus')).toHaveCount(0)

    expect(await testHelpers.isWorkspaceGetStarted()).toBe(true)
    expect(await testHelpers.isWorkspaceReady()).toBe(false)
  })

  test('renders the base home layout structure', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    // Validate key structural elements without relying on text matching.
    const pageStructure = await testHelpers.validatePageStructure()
    expect(pageStructure.hasMainElement).toBe(true)
    expect(pageStructure.hasSidebar).toBe(true)
    expect(pageStructure.hasWelcomeText).toBe(true)

    const titleBox = await mainWindow.locator('[data-testid="home-title"]').boundingBox()
    const separatorBox = await mainWindow
      .locator('[data-testid="home-title-separator"]')
      .boundingBox()

    expect(titleBox).not.toBeNull()
    expect(separatorBox).not.toBeNull()
    expect(Math.abs(separatorBox!.width - titleBox!.width)).toBeLessThanOrEqual(1)
  })

  test('keeps the title reachable at the minimum window height', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await electronApp.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window) throw new Error('Missing main window')
      window.setSize(800, 600)
    })

    const homeScreen = mainWindow.locator('[data-testid="home-screen"]')
    const homeTitle = mainWindow.locator('[data-testid="home-title"]')

    await expect
      .poll(async () =>
        homeScreen.evaluate((element) => element.scrollHeight > element.clientHeight)
      )
      .toBe(true)

    const [homeScreenBox, homeTitleBox] = await Promise.all([
      homeScreen.boundingBox(),
      homeTitle.boundingBox()
    ])

    expect(homeScreenBox).not.toBeNull()
    expect(homeTitleBox).not.toBeNull()
    expect(homeTitleBox!.y).toBeGreaterThanOrEqual(homeScreenBox!.y)
    expect(await homeScreen.evaluate((element) => element.scrollTop)).toBe(0)
  })

  test('stacks the title words at the same breakpoint as the cards', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const cthulhuWord = mainWindow.locator('[data-testid="home-title-word-cthulhu"]')
    const promptWord = mainWindow.locator('[data-testid="home-title-word-prompt"]')
    const homeLayout = mainWindow.locator('[data-testid="home-layout"]')
    const setHomeLayoutWidth = async (width: number) => {
      const currentWidth = await homeLayout.evaluate((element) => element.getBoundingClientRect().width)
      await electronApp.evaluate(
        ({ BrowserWindow }, widthDelta) => {
          const window = BrowserWindow.getAllWindows()[0]
          if (!window) throw new Error('Missing main window')
          const bounds = window.getBounds()
          window.setSize(bounds.width + widthDelta, bounds.height)
        },
        Math.round(width - currentWidth)
      )
      await expect
        .poll(async () => homeLayout.evaluate((element) => element.getBoundingClientRect().width))
        .toBe(width)
    }

    await setHomeLayoutWidth(1023)
    const [narrowCthulhuBox, narrowPromptBox] = await Promise.all([
      cthulhuWord.boundingBox(),
      promptWord.boundingBox()
    ])
    expect(narrowCthulhuBox).not.toBeNull()
    expect(narrowPromptBox).not.toBeNull()
    expect(narrowPromptBox!.y).toBeGreaterThanOrEqual(
      narrowCthulhuBox!.y + narrowCthulhuBox!.height - 1
    )

    await setHomeLayoutWidth(1024)
    const [wideCthulhuBox, widePromptBox] = await Promise.all([
      cthulhuWord.boundingBox(),
      promptWord.boundingBox()
    ])
    expect(wideCthulhuBox).not.toBeNull()
    expect(widePromptBox).not.toBeNull()
    expect(Math.abs(widePromptBox!.y - wideCthulhuBox!.y)).toBeLessThanOrEqual(1)
  })

  test('switches card columns without changing their maximum width', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const homeLayout = mainWindow.locator('[data-testid="home-layout"]')
    const primaryCard = mainWindow.locator('[data-testid="home-primary-card"]')
    const actionsCard = mainWindow.locator('[data-testid="home-workspace-actions-card"]')
    const setHomeLayoutWidth = async (width: number) => {
      const currentWidth = await homeLayout.evaluate((element) => element.getBoundingClientRect().width)
      await electronApp.evaluate(
        ({ BrowserWindow }, widthDelta) => {
          const window = BrowserWindow.getAllWindows()[0]
          if (!window) throw new Error('Missing main window')
          const bounds = window.getBounds()
          window.setSize(bounds.width + widthDelta, bounds.height)
        },
        Math.round(width - currentWidth)
      )
      await expect
        .poll(async () => homeLayout.evaluate((element) => element.getBoundingClientRect().width))
        .toBe(width)
    }

    await setHomeLayoutWidth(1023)
    const [stackedPrimaryBox, stackedActionsBox] = await Promise.all([
      primaryCard.boundingBox(),
      actionsCard.boundingBox()
    ])
    expect(stackedPrimaryBox).not.toBeNull()
    expect(stackedActionsBox).not.toBeNull()
    expect(Math.abs(stackedPrimaryBox!.width - 504)).toBeLessThanOrEqual(1)
    expect(Math.abs(stackedActionsBox!.width - 504)).toBeLessThanOrEqual(1)
    expect(stackedActionsBox!.y).toBeGreaterThan(stackedPrimaryBox!.y + stackedPrimaryBox!.height)

    await setHomeLayoutWidth(1024)
    const [widePrimaryBox, wideActionsBox] = await Promise.all([
      primaryCard.boundingBox(),
      actionsCard.boundingBox()
    ])
    expect(widePrimaryBox).not.toBeNull()
    expect(wideActionsBox).not.toBeNull()
    expect(Math.abs(stackedPrimaryBox!.width - widePrimaryBox!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(stackedActionsBox!.width - wideActionsBox!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(wideActionsBox!.y - widePrimaryBox!.y)).toBeLessThanOrEqual(1)
  })

  describe('Workspace Management', () => {
    test('closes a workspace while hydrated folder settings are mounted', async ({ testSetup }) => {
      const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
        workspace: { scenario: 'categories' }
      })

      expect(workspaceSetupResult.setupDialogAppeared).toBe(false)
      expect(workspaceSetupResult.workspaceReady).toBe(true)

      await testHelpers.assertWorkspaceReadyPath('/ws/categories')
      await testHelpers.navigateToPromptFolders('Main')
      await mainWindow.locator('[data-testid="category-editor-settings-toggle"]').click()
      await expect(
        mainWindow.locator('[data-testid^="category-description-section"] .monaco-editor')
      ).not.toHaveCount(0)
      await testHelpers.navigateToHomeScreen()

      await testHelpers.clearWorkspaceViaUI()
      expect(await testHelpers.isWorkspaceGetStarted()).toBe(true)
      expect(await testHelpers.isWorkspaceReady()).toBe(false)
    })

    test('copies the current workspace path and briefly shows copied state', async ({
      testSetup
    }) => {
      const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
        workspace: { scenario: 'minimal' }
      })

      expect(workspaceSetupResult.workspaceReady).toBe(true)
      await testHelpers.assertWorkspaceReadyPath('/ws/minimal')
      await stubClipboard(mainWindow)

      const copyButton = mainWindow.locator('[data-testid="copy-workspace-path-button"]')
      await expect(copyButton).toHaveAttribute('aria-label', 'Copy workspace path')
      await copyButton.click()

      await expect
        .poll(async () => {
          return await mainWindow.evaluate(() => (window as any).__testClipboardText ?? '')
        })
        .toBe('/ws/minimal')
      await expect(copyButton).toHaveAttribute('aria-label', 'Copied')
      await expect(copyButton).toHaveAttribute('aria-label', 'Copy workspace path', {
        timeout: 2500
      })
    })

    test('keeps workspace ready across navigation', async ({ testSetup }) => {
      const { testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
        workspace: { scenario: 'minimal' }
      })

      expect(workspaceSetupResult.workspaceReady).toBe(true)

      await testHelpers.navigateToSettingsScreen()
      await testHelpers.navigateToHomeScreen()

      expect(await testHelpers.isWorkspaceReady()).toBe(true)
    })

    test('shows an error dialog when opening an empty directory', async ({ testSetup }) => {
      const { mainWindow } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-directory-open', autoSetup: false }
      })

      await mainWindow.click('[data-testid="open-workspace-button"]')

      const errorDialog = mainWindow.locator(
        '[role="dialog"][aria-label="Failed to Open Workspace"]'
      )
      await expect(errorDialog).toBeVisible()
      await expect(errorDialog.locator('[data-testid="dialog-header-icon"]')).toBeVisible()
      await expect(errorDialog.locator('[data-testid="dialog-subtitle"]')).toHaveCount(0)
      await expect(errorDialog).toHaveCSS('padding-top', '16px')
      await expect(errorDialog.locator('.cthulhuUiDialogHeader')).toHaveCSS(
        'padding-bottom',
        '12px'
      )
      await expect(errorDialog.locator('.cthulhuUiDialogHeader .cthulhuUiTitle')).toHaveCSS(
        'line-height',
        '22px'
      )
      await expect(errorDialog).toContainText('The workspace could not be opened.')
      await expect(errorDialog).toContainText('Invalid workspace path')
    })

    test('rejects a workspace without a Templates directory', async ({ testSetup }) => {
      const workspacePath = '/ws/missing-templates'
      const filesystem = createWorkspaceWithFolders(workspacePath, [])
      delete filesystem[`${workspacePath}/Templates`]

      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="open-workspace-button"]')

      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Failed to Open Workspace"]')
      ).toBeVisible()
      expect(await testHelpers.isWorkspaceReady()).toBe(false)
    })

    test('repairs a missing workspace folder order during load', async ({
      electronApp,
      testSetup
    }) => {
      const workspacePath = '/ws/missing-folder-order'
      const filesystem = createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Examples',
          displayName: 'Examples',
          promptFolderId: 'folder-examples'
        }
      ])
      delete filesystem[workspaceFolderOrderPath(workspacePath)]

      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="open-workspace-button"]')

      await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toBeVisible()
      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Failed to Open Workspace"]')
      ).toHaveCount(0)
      expect(await testHelpers.isWorkspaceReady()).toBe(true)
      expect(await checkFileExists(electronApp, workspaceFolderOrderPath(workspacePath))).toBe(true)
    })

    test('rejects malformed workspace folder order JSON', async ({ testSetup }) => {
      const workspacePath = '/ws/malformed-folder-order'
      const filesystem = createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Examples',
          displayName: 'Examples',
          promptFolderId: 'folder-examples'
        }
      ])
      filesystem[workspaceFolderOrderPath(workspacePath)] = '{ malformed'

      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="open-workspace-button"]')

      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Failed to Open Workspace"]')
      ).toBeVisible()
      expect(await testHelpers.isWorkspaceReady()).toBe(false)
    })

    test('shows create dialog for empty directory creation and completes setup', async ({
      testSetup
    }) => {
      const { testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-directory', autoSetup: false }
      })

      const setupResult = await testHelpers.createWorkspaceViaUI()
      expect(setupResult.setupDialogAppeared).toBe(true)
      expect(setupResult.workspaceReady).toBe(true)
    })

    test('keeps create workspace dialog open after outside click', async ({ testSetup }) => {
      const { mainWindow } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="create-workspace-button"]')

      const createDialog = mainWindow.locator('[role="dialog"][aria-label="Create Workspace"]')
      await expect(createDialog).toBeVisible()
      await expect(createDialog.locator('[data-testid="dialog-header-icon"]')).toBeVisible()
      await expect(createDialog.locator('[data-testid="dialog-subtitle"]')).toHaveText(
        'Choose a name and location for your new workspace.'
      )
      await expect(createDialog).toHaveCSS('padding-top', '18px')
      await expect(createDialog.locator('.cthulhuUiDialogHeader')).toHaveCSS(
        'padding-bottom',
        '16px'
      )
      await expect(createDialog.locator('.cthulhuUiDialogHeader .cthulhuUiTitle')).toHaveCSS(
        'line-height',
        '24px'
      )
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Example Workspace')

      await mainWindow.mouse.click(10, 10)

      await expect(createDialog).toBeVisible()
      await expect(mainWindow.locator('[data-testid="create-workspace-name-input"]')).toHaveValue(
        'Example Workspace'
      )
    })

    test('adds example prompts and a template when setting up a new workspace', async ({
      testSetup
    }) => {
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-with-examples', autoSetup: false }
      })

      await mainWindow.click('[data-testid="create-workspace-button"]')

      const createDialog = mainWindow.locator('[role="dialog"][aria-label="Create Workspace"]')
      await expect(createDialog).toBeVisible()
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Example Workspace')
      await mainWindow.click('[data-testid="create-workspace-path-browse-button"]')

      const includeExamplesToggle = mainWindow.locator(
        '[data-testid="create-workspace-examples-toggle"]'
      )
      await expect(includeExamplesToggle).toBeVisible()
      await expect(includeExamplesToggle).toHaveAttribute('aria-pressed', 'true')

      await expect(
        mainWindow.locator('[data-testid="create-workspace-submit-button"]')
      ).toBeEnabled()
      await mainWindow.click('[data-testid="create-workspace-submit-button"]')
      await mainWindow.waitForSelector('[data-testid="workspace-ready-path"]', {
        state: 'visible',
        timeout: 5000
      })

      expect(await testHelpers.isWorkspaceReady()).toBe(true)

      await testHelpers.navigateToPromptFolders('My Prompts')
      await mainWindow.waitForSelector('[data-testid="prompt-folder-screen"]', { state: 'visible' })
      await mainWindow.waitForSelector('[data-testid^="prompt-editor-"]', {
        state: 'attached'
      })

      const firstPrompt = await testHelpers.verifyPromptVisible(
        'Example: Add Birthday Date to Settings Page'
      )
      const secondPrompt = await testHelpers.verifyPromptVisible(
        'Example: Define Example Prompts in Files'
      )
      expect(firstPrompt.found).toBe(true)
      expect(secondPrompt.found).toBe(true)

      const screenInfo = await testHelpers.getPromptFolderScreenInfo()
      expect(screenInfo.promptCount).toBe(2)

      const categoryToggles = mainWindow.locator(
        '[data-testid^="prompt-tree-category-toggle-button-"]'
      )
      await expect(categoryToggles).toHaveCount(3)
      await expect(categoryToggles.nth(0)).toContainText('New Features')
      await expect(categoryToggles.nth(1)).toContainText('Improvements')
      await expect(categoryToggles.nth(2)).toContainText('Bug Fixes')

      const birthdayPromptTreeRow = mainWindow.locator('[data-testid^="prompt-tree-prompt-"]', {
        hasText: 'Example: Add Birthday Date to Settings Page'
      })
      const bundledFilesPromptTreeRow = mainWindow.locator(
        '[data-testid^="prompt-tree-prompt-"]',
        { hasText: 'Example: Define Example Prompts in Files' }
      )
      await expect(birthdayPromptTreeRow).toBeVisible()
      await expect(bundledFilesPromptTreeRow).toBeVisible()
      await categoryToggles.nth(0).click()
      await expect(birthdayPromptTreeRow).toHaveCount(0)
      await expect(bundledFilesPromptTreeRow).toBeVisible()
      await categoryToggles.nth(1).click()
      await expect(bundledFilesPromptTreeRow).toHaveCount(0)
      await expect(mainWindow.locator('[data-testid^="prompt-tree-prompt-"]')).toHaveCount(0)

      await mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]').click()
      await expect(
        mainWindow.locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]')
      ).toHaveCount(2)
      await expect(
        mainWindow.locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]').nth(0)
      ).toContainText('My Prompts')
      await expect(
        mainWindow.locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]').nth(1)
      ).toContainText('My Templates')
      await expect(
        mainWindow.locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]').nth(1)
      ).toContainText('1 template')
      await mainWindow
        .locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]')
        .nth(1)
        .click()
      const exampleTemplate = await testHelpers.verifyPromptVisible('Example Template')
      expect(exampleTemplate.found).toBe(true)
      expect((await testHelpers.getPromptFolderScreenInfo()).promptCount).toBe(1)
    })

    test('creates a blank My Prompts folder when examples are disabled', async ({ testSetup }) => {
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-without-examples', autoSetup: false }
      })

      await mainWindow.click('[data-testid="create-workspace-button"]')

      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Create Workspace"]')
      ).toBeVisible()
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Blank Workspace')
      await mainWindow.click('[data-testid="create-workspace-path-browse-button"]')

      const includeExamplesToggle = mainWindow.locator(
        '[data-testid="create-workspace-examples-toggle"]'
      )
      await expect(includeExamplesToggle).toHaveAttribute('aria-pressed', 'true')
      await includeExamplesToggle.click()
      await expect(includeExamplesToggle).toHaveAttribute('aria-pressed', 'false')

      await mainWindow.click('[data-testid="create-workspace-submit-button"]')
      await mainWindow.waitForSelector('[data-testid="workspace-ready-path"]', {
        state: 'visible',
        timeout: 5000
      })

      expect(await testHelpers.isWorkspaceReady()).toBe(true)

      await testHelpers.navigateToPromptFolders('My Prompts')
      await expect(mainWindow.locator('[data-testid="prompt-folder-header-folder"]')).toHaveText(
        'My Prompts'
      )

      const screenInfo = await testHelpers.getPromptFolderScreenInfo()
      expect(screenInfo.hasPromptEditors).toBe(false)
      expect(screenInfo.promptCount).toBe(0)

      await mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]').click()
      await expect(
        mainWindow.locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]')
      ).toHaveCount(2)
      await expect(
        mainWindow.locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]').nth(0)
      ).toContainText('My Prompts')
      await expect(
        mainWindow.locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]').nth(1)
      ).toContainText('My Templates')
      await expect(
        mainWindow.locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]').nth(1)
      ).toContainText('0 templates')

      await mainWindow
        .locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]')
        .nth(1)
        .click()
      await expect(mainWindow.locator('[data-testid="prompt-folder-header-folder"]')).toHaveText(
        'My Templates'
      )
      expect((await testHelpers.getPromptFolderScreenInfo()).promptCount).toBe(0)
    })

    test('disables Create Workspace for invalid workspace names', async ({ testSetup }) => {
      await testSetup.setupFilesystem({ '/ws/invalid-name-containing': null })
      await testSetup.setupFileDialog(['/ws/invalid-name-containing'])

      const { mainWindow } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="create-workspace-button"]')
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Bad/Name')
      await mainWindow.click('[data-testid="create-workspace-path-browse-button"]')

      await expect(mainWindow.locator('[data-testid="create-workspace-name-error"]')).toContainText(
        'Workspace name contains illegal characters'
      )
      await expect(
        mainWindow.locator('[data-testid="create-workspace-submit-button"]')
      ).toBeDisabled()
    })

    test('warns when the final workspace folder is not empty without blocking creation', async ({
      testSetup
    }) => {
      await testSetup.setupFilesystem({
        '/ws/non-empty-containing': null,
        '/ws/non-empty-containing\\ClientPrompts': null,
        '/ws/non-empty-containing\\ClientPrompts/notes.txt': 'Existing file'
      })
      await testSetup.setupFileDialog(['/ws/non-empty-containing'])

      const { mainWindow } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="create-workspace-button"]')
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Client Prompts')
      await mainWindow.click('[data-testid="create-workspace-path-browse-button"]')

      await expect(
        mainWindow.locator('[data-testid="create-workspace-final-path-display"]')
      ).toContainText('/ws/non-empty-containing\\ClientPrompts')
      await expect(
        mainWindow.locator('[data-testid="create-workspace-final-path-message"]')
      ).toContainText(
        'This folder is not empty. Typically, you should create a workspace in an empty folder.'
      )
      await expect(
        mainWindow.locator('[data-testid="create-workspace-submit-button"]')
      ).toBeEnabled()
    })
  })
})
