import { runSqlQuery } from '../helpers/UserPersistenceHelpers'
import { readTabSession, readWorkspaceCollectionOrder } from '../helpers/UserPersistenceHelpers'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { checkFileExists } from '../helpers/PromptPersistenceTestHelpers'
import { PromptStatus } from '@shared/domain/prompt/Prompt'

const { test, describe, expect } = createPlaywrightTestSuite()

const workspaceCollectionOrderPath = (workspacePath: string): string =>
  `${workspacePath}/DefaultProject/Prompts/CollectionOrder.json`

describe('Home Screen', () => {
  test('shows the get started state on launch without a workspace', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    // Confirm the app rendered the home screen before checking state.
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="create-workspace-button"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toHaveCount(0)
    await expect(mainWindow.getByTestId('home-primary-card')).toContainText(
      'Open a workspace or create one to get started.'
    )
    // New tabs need a workspace, so Home does not prompt for one yet and Open stays the accent action.
    await expect(mainWindow.getByTestId('home-new-tab-card')).toHaveCount(0)
    await expect(mainWindow.getByTestId('open-workspace-button')).toHaveAttribute('data-variant', 'accent')
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
    expect(pageStructure.hasSidebar).toBe(false)
    expect(pageStructure.hasWelcomeText).toBe(true)

    await expect(mainWindow.getByTestId('home-title')).toHaveText('Cthulhu Prompt')
    await expect(mainWindow.getByTestId('home-primary-card')).toContainText('No workspace open')
    await expect(mainWindow.getByTestId('close-workspace-button')).toBeDisabled()
    await expect(mainWindow.getByTestId('home-open-workspace-folder-button')).toBeDisabled()
    await expect(mainWindow.getByTestId('show-welcome-button')).toBeVisible()
    await expect(mainWindow.getByTestId('get-started-github-issues-link')).toHaveAttribute(
      'href',
      'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
    )
  })

  test('keeps the workspace card and actions within the screen at narrow and wide sizes', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    await mainWindow.getByTestId('nav-button-home').click()
    for (const width of [800, 1400]) {
      await electronApp.evaluate(({ BrowserWindow }, windowWidth) => {
        const window = BrowserWindow.getAllWindows()[0]
        if (!window) throw new Error('Missing main window')
        window.setSize(windowWidth, 600)
      }, width)

      const homeScreen = mainWindow.getByTestId('home-screen')
      await expect(mainWindow.getByTestId('home-title')).toBeInViewport()
      await expect(mainWindow.getByTestId('close-workspace-button')).toBeInViewport()
      await expect
        .poll(() => homeScreen.evaluate((element) => element.scrollWidth - element.clientWidth))
        .toBeLessThanOrEqual(1)

      const [screenBox, cardBox, titleBox, openBox, closeBox] = await Promise.all([
        homeScreen.boundingBox(),
        mainWindow.getByTestId('home-primary-card').boundingBox(),
        mainWindow.getByTestId('home-title').boundingBox(),
        mainWindow.getByTestId('open-workspace-button').boundingBox(),
        mainWindow.getByTestId('close-workspace-button').boundingBox()
      ])
      expect(cardBox!.width).toBeLessThanOrEqual(781)
      expect(cardBox!.x).toBeGreaterThanOrEqual(screenBox!.x)
      expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(screenBox!.x + screenBox!.width + 1)
      expect(cardBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height)
      expect(Math.abs(openBox!.y - closeBox!.y)).toBeLessThanOrEqual(1)
      expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height)
    }
  })

  test('prompts for a New Tab only while the open workspace has no tabs', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    /** Home callout that points an open workspace without tabs to the tab bar. */
    const newTabCard = mainWindow.getByTestId('home-new-tab-card')
    /** Work tabs in the title bar. */
    const workTabs = mainWindow.getByTestId('work-tab')

    // The workspace restores with its initial tab, so Home has no callout.
    await expect(workTabs).toHaveCount(1)
    await testHelpers.navigateToHomeScreen()
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(newTabCard).toHaveCount(0)

    // Closing the last tab shows the callout, whose New Tab button is the only accent action.
    // Keyboard closing avoids the mouse close's held strip width, which polls the real OS cursor.
    await mainWindow.getByTestId('work-tab-close').press('Enter')
    await expect(workTabs).toHaveCount(0)
    await expect(newTabCard).toBeVisible()
    await expect(
      mainWindow.getByTestId('home-screen').locator('button[data-variant="accent"]')
    ).toHaveText('New Tab')

    // The callout's button opens and selects a New Tab, like the title bar's New Tab button.
    await mainWindow.getByTestId('home-new-tab-button').click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(workTabs).toHaveCount(1)
    await expect(workTabs).toHaveAttribute('data-selected', 'true')
    await testHelpers.navigateToHomeScreen()
    await expect(newTabCard).toHaveCount(0)
  })

  describe('Workspace Management', () => {
    test('counts every prompt and collection type in the workspace statistics', async ({
      testSetup
    }) => {
      const workspacePath = '/ws/home-workspace-statistics'
      const filesystem = {
        ...createWorkspaceWithCollections(workspacePath, [
          {
            folderName: 'Tasks',
            displayName: 'Tasks',
            promptCollectionId: 'home-task-collection',
            prompts: [
              { id: 'home-active', title: 'Active', promptText: 'Active prompt' },
              {
                id: 'home-completed',
                title: 'Completed',
                promptText: 'Completed prompt',
                status: PromptStatus.Completed,
                finalizedAt: '2026-09-09T12:00:00.000Z'
              },
              {
                id: 'home-archived',
                title: 'Archived',
                promptText: 'Archived prompt',
                status: PromptStatus.Archived,
                finalizedAt: '2026-09-08T12:00:00.000Z'
              }
            ]
          }
        ]),
        ...createWorkspaceWithTemplateCollections(workspacePath, [
          {
            folderName: 'Templates',
            displayName: 'Templates',
            collectionId: 'home-template-collection',
            templates: [
              { id: 'home-template-one', title: 'Template One', templateText: 'First template' },
              { id: 'home-template-two', title: 'Template Two', templateText: 'Second template' }
            ]
          }
        ]),
        [workspaceCollectionOrderPath(workspacePath)]: JSON.stringify({
          entries: [{ kind: 'collection', id: 'home-task-collection' }]
        }),
        [`${workspacePath}/DefaultProject/Templates/CollectionOrder.json`]: JSON.stringify({
          entries: [{ kind: 'collection', id: 'home-template-collection' }]
        })
      }

      await testSetup.setupFilesystem(filesystem)
      testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(workspacePath))
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await testHelpers.setupWorkspaceViaUI()

      await testHelpers.navigateToHomeScreen()
      const promptStat = mainWindow.locator('[data-testid="home-prompt-count-stat"]')
      await expect(promptStat.locator('strong')).toHaveText('5')
      await expect(promptStat).toContainText('Prompts')
      const promptCollectionStat = mainWindow.locator(
        '[data-testid="home-prompt-collection-count-stat"]'
      )
      await expect(promptCollectionStat.locator('strong')).toHaveText('2')
      await expect(promptCollectionStat).toContainText('Prompt Collections')
    })

    test('closes a workspace after category management has mounted', async ({ testSetup }) => {
      const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
        workspace: { scenario: 'categories' }
      })

      expect(workspaceSetupResult!.setupDialogAppeared).toBe(false)
      expect(workspaceSetupResult!.workspaceReady).toBe(true)

      await testHelpers.navigateToHomeScreen()
      await testHelpers.assertWorkspaceReadyPath('/ws/categories')
      await testHelpers.navigateToPromptCollections('Main')
      await mainWindow.locator('[data-testid="prompt-collection-manage-categories-button"]').click()
      await expect(mainWindow.getByRole('dialog', { name: 'Manage Categories' })).toBeVisible()
      await mainWindow.locator('[data-testid="manage-categories-close-button"]').click()
      await testHelpers.navigateToHomeScreen()

      await testHelpers.clearWorkspaceViaUI()
      expect(await testHelpers.isWorkspaceGetStarted()).toBe(true)
      expect(await testHelpers.isWorkspaceReady()).toBe(false)
    })

    test('keeps workspace ready across navigation', async ({ testSetup }) => {
      const { testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
        workspace: { scenario: 'minimal' }
      })

      expect(workspaceSetupResult!.workspaceReady).toBe(true)

      await testHelpers.navigateToSettingsScreen()
      await testHelpers.navigateToHomeScreen()

      expect(await testHelpers.isWorkspaceReady()).toBe(true)
    })

    test('initializes a missing SQLite collection order during load', async ({
      electronApp,
      testSetup
    }) => {
      const workspacePath = '/ws/missing-collection-order'
      const filesystem = createWorkspaceWithCollections(workspacePath, [
        {
          folderName: 'Examples',
          displayName: 'Examples',
          promptCollectionId: 'collection-examples'
        }
      ])
      delete filesystem[workspaceCollectionOrderPath(workspacePath)]

      await testSetup.setupFilesystem(filesystem)
      testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(workspacePath))
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await testHelpers.setupWorkspaceViaUI()

      await mainWindow.getByTestId('nav-button-home').click()
      await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toBeVisible()
      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Failed to Open Workspace"]')
      ).toHaveCount(0)
      expect(await testHelpers.isWorkspaceReady()).toBe(true)
      expect(await checkFileExists(electronApp, workspaceCollectionOrderPath(workspacePath))).toBe(false)
      expect(await readWorkspaceCollectionOrder(electronApp, workspacePath)).toEqual({ entries: [{ kind: 'collection', id: 'collection-examples' }] })
    })

    test('shows create dialog for empty directory creation and completes setup', async ({
      electronApp,
      testSetup
    }) => {
      /** Running application and helpers used to create and inspect a new workspace. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-directory', autoSetup: false }
      })

      /** Successful UI creation result for the new workspace. */
      const setupResult = await testHelpers.createWorkspaceViaUI()
      expect(setupResult.setupDialogAppeared).toBe(true)
      expect(setupResult.workspaceReady).toBe(true)
      /** Default collection tabs must appear without manually navigating to either collection. */
      const tabs = mainWindow.getByTestId('work-tab').getByRole('tab')
      await expect(tabs).toHaveText(['My Prompts', 'My Templates'])
      await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
      await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Prompts')
      await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Active')

      // The newly created session survives a reload with the same selected collection.
      await mainWindow.reload()
      await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
      await expect(tabs).toHaveText(['My Prompts', 'My Templates'])
      await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
      await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Prompts')
      await testHelpers.navigateToHomeScreen()
      /** Created workspace root shown by the ready-state home screen. */
      const workspacePath = await testHelpers.getDisplayedWorkspacePath()
      expect(workspacePath).not.toBeNull()
      /** Persisted identity lets the test wait for later user changes before reopening. */
      const workspaceId = (await runSqlQuery(electronApp, 'SELECT id FROM content.workspace')).rows![0].id as string

      // Later selection and tab closure must replace the initial defaults permanently.
      await tabs.nth(1).click()
      await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Templates')
      await mainWindow.getByTestId('work-tab-close').nth(0).press('Enter')
      await expect(tabs).toHaveText(['My Templates'])
      await expect.poll(async () => {
        /** Observe the saved single-tab session before reloading the renderer. */
        const saved = (await readTabSession(electronApp, workspaceId)).user
        return [saved?.tabs.length, saved?.selectedTabId === saved?.tabs[0]?.id]
      }).toEqual([1, true])
      await mainWindow.reload()
      await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
      await expect(tabs).toHaveText(['My Templates'])
      await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
      await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Templates')
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
        'Choose a name for your new workspace.'
      )
      await expect(createDialog.locator('.cthulhuUiPopupSurface')).toHaveCSS('padding-top', '18px')
      await expect(createDialog.locator('.cthulhuUiDialogHeader')).toHaveCSS(
        'padding-bottom',
        '16px'
      )
      await expect(createDialog.locator('.cthulhuUiDialogHeader .cthulhuUiTitle')).toHaveCSS(
        'line-height',
        '28px'
      )
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Example Workspace')

      await mainWindow.mouse.click(10, 10)

      await expect(createDialog).toBeVisible()
      await expect(mainWindow.locator('[data-testid="create-workspace-name-input"]')).toHaveValue(
        'Example Workspace'
      )
    })

    test('adds example prompts and templates when setting up a new workspace', async ({
      testSetup
    }) => {
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-with-examples', autoSetup: false }
      })

      await mainWindow.click('[data-testid="create-workspace-button"]')

      const createDialog = mainWindow.locator('[role="dialog"][aria-label="Create Workspace"]')
      await expect(createDialog).toBeVisible()
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Example Workspace')

      const includeExamplesToggle = mainWindow.locator(
        '[data-testid="create-workspace-examples-toggle"]'
      )
      await expect(includeExamplesToggle).toBeVisible()
      await expect(includeExamplesToggle).toHaveAttribute('aria-pressed', 'true')

      await expect(
        mainWindow.locator('[data-testid="create-workspace-submit-button"]')
      ).toBeEnabled()
      await mainWindow.click('[data-testid="create-workspace-submit-button"]')
      await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveText(['My Prompts', 'My Templates'])
      await expect(mainWindow.getByTestId('work-tab').getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true')
      await mainWindow.waitForSelector('[data-testid="prompt-collection-screen"]', {
        state: 'visible',
        timeout: 5000
      })

      expect(await testHelpers.isWorkspaceReady()).toBe(true)

      await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Prompts')
      await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Active')
      await mainWindow.waitForSelector('[data-testid="prompt-collection-screen"]', { state: 'visible' })
      await mainWindow.waitForSelector('[data-testid^="prompt-editor-"]', {
        state: 'attached'
      })

      const firstPrompt = await testHelpers.verifyPromptVisible(
        'Example: Add Birthday Date to Settings Page'
      )
      const secondPrompt = await testHelpers.verifyPromptVisible(
        'Example: Define Example Prompts in Files'
      )
      const thirdPrompt = await testHelpers.verifyPromptVisible(
        'Example: Investigate Category Persistence Bug'
      )
      expect(firstPrompt.found).toBe(true)
      expect(secondPrompt.found).toBe(true)
      expect(thirdPrompt.found).toBe(true)

      const getTemplateLabel = (promptTitle: string): Promise<string | null> =>
        mainWindow.locator('[data-testid="prompt-title"]').evaluateAll((titleInputs, title) => {
          const titleInput = titleInputs.find(
            (element) => (element as HTMLInputElement).value === title
          )
          return (
            titleInput
              ?.closest('[data-testid^="prompt-editor-"]')
              ?.querySelector('.prompt-editor-metadata-template')
              ?.textContent?.trim() ?? null
          )
        }, promptTitle)
      await expect
        .poll(() => getTemplateLabel('Example: Define Example Prompts in Files'))
        .toBe('Example: Q&A with Implementation & Testing')
      await expect
        .poll(() => getTemplateLabel('Example: Investigate Category Persistence Bug'))
        .toBe('Example: Bug Fix Template')

      const screenInfo = await testHelpers.getPromptCollectionScreenInfo()
      expect(screenInfo.promptCount).toBe(3)

      const categoryToggles = mainWindow.locator(
        '[data-testid^="prompt-tree-active-category-toggle-button-"]'
      )
      await expect(categoryToggles).toHaveCount(2)
      await expect(categoryToggles.nth(0)).toContainText('Features & Improvements')
      await expect(categoryToggles.nth(1)).toContainText('Bug Fixes')

      const birthdayPromptTreeRow = mainWindow.locator('[data-testid^="prompt-tree-active-prompt-"]', {
        hasText: 'Example: Add Birthday Date to Settings Page'
      })
      const bundledFilesPromptTreeRow = mainWindow.locator(
        '[data-testid^="prompt-tree-active-prompt-"]',
        { hasText: 'Example: Define Example Prompts in Files' }
      )
      const categoryPersistencePromptTreeRow = mainWindow.locator(
        '[data-testid^="prompt-tree-active-prompt-"]',
        { hasText: 'Example: Investigate Category Persistence Bug' }
      )
      await expect(birthdayPromptTreeRow).toBeVisible()
      await expect(bundledFilesPromptTreeRow).toBeVisible()
      await expect(categoryPersistencePromptTreeRow).toBeVisible()
      await categoryToggles.nth(0).click()
      await expect(birthdayPromptTreeRow).toHaveCount(0)
      await expect(bundledFilesPromptTreeRow).toHaveCount(0)
      await expect(categoryPersistencePromptTreeRow).toBeVisible()
      await categoryToggles.nth(1).click()
      await expect(mainWindow.locator('[data-testid^="prompt-tree-active-prompt-"]')).toHaveCount(0)

      // The default project lists both kinds together in combined alphabetical order.
      await mainWindow.locator('[data-testid="sidebar-show-all-button"]').click()
      await expect(
        mainWindow.locator('[data-testid^="new-tab-collection-"]')
      ).toHaveCount(2)
      await expect(
        mainWindow.locator('[data-testid^="new-tab-collection-"]').nth(0)
      ).toContainText('My Prompts')
      await expect(
        mainWindow.locator('[data-testid^="new-tab-collection-"]').nth(1)
      ).toContainText('My Templates')
      await expect(
        mainWindow.locator('[data-testid^="new-tab-collection-"]').nth(1)
      ).toContainText('3 templates')
      await mainWindow
        .locator('[data-testid^="new-tab-collection-"]')
        .nth(1)
        .click()
      // The tree lists every template, unlike the virtualized editors below the viewport.
      await expect(
        mainWindow.locator('[data-testid^="prompt-tree-template-prompt-"]')
      ).toHaveText([
        'Example: Simple Template',
        'Example: Q&A with Implementation & Testing',
        'Example: Bug Fix Template'
      ])
    })

    test('creates a blank My Prompts collection when examples are disabled', async ({ testSetup }) => {
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-without-examples', autoSetup: false }
      })

      await mainWindow.click('[data-testid="create-workspace-button"]')

      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Create Workspace"]')
      ).toBeVisible()
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Blank Workspace')

      const includeExamplesToggle = mainWindow.locator(
        '[data-testid="create-workspace-examples-toggle"]'
      )
      await expect(includeExamplesToggle).toHaveAttribute('aria-pressed', 'true')
      await includeExamplesToggle.click()
      await expect(includeExamplesToggle).toHaveAttribute('aria-pressed', 'false')

      await mainWindow.click('[data-testid="create-workspace-submit-button"]')
      await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveText(['My Prompts', 'My Templates'])
      await expect(mainWindow.getByTestId('work-tab').getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true')
      await mainWindow.waitForSelector('[data-testid="prompt-collection-screen"]', {
        state: 'visible',
        timeout: 5000
      })

      expect(await testHelpers.isWorkspaceReady()).toBe(true)

      await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Active')
      await expect(mainWindow.locator('[data-testid="prompt-collection-header-collection"]')).toHaveText(
        'My Prompts'
      )

      const screenInfo = await testHelpers.getPromptCollectionScreenInfo()
      expect(screenInfo.hasPromptEditors).toBe(false)
      expect(screenInfo.promptCount).toBe(0)

      // The default project lists both kinds together in combined alphabetical order.
      await mainWindow.locator('[data-testid="sidebar-show-all-button"]').click()
      await expect(
        mainWindow.locator('[data-testid^="new-tab-collection-"]')
      ).toHaveCount(2)
      await expect(
        mainWindow.locator('[data-testid^="new-tab-collection-"]').nth(0)
      ).toContainText('My Prompts')
      await expect(
        mainWindow.locator('[data-testid^="new-tab-collection-"]').nth(1)
      ).toContainText('My Templates')
      await expect(
        mainWindow.locator('[data-testid^="new-tab-collection-"]').nth(1)
      ).toContainText('0 templates')

      await mainWindow
        .locator('[data-testid^="new-tab-collection-"]')
        .nth(1)
        .click()
      await expect(mainWindow.locator('[data-testid="prompt-collection-header-collection"]')).toHaveText(
        'My Templates'
      )
      expect((await testHelpers.getPromptCollectionScreenInfo()).promptCount).toBe(0)
    })

    test('disables Create Workspace for invalid workspace names', async ({ testSetup }) => {
      await testSetup.setupFilesystem({ '/ws/invalid-name-containing': null })
      await testSetup.setupFileDialog(['/ws/invalid-name-containing'])

      const { mainWindow } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="create-workspace-button"]')
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Bad/Name')

      await expect(mainWindow.locator('[data-testid="create-workspace-name-error"]')).toContainText(
        'Workspace name contains illegal characters'
      )
      await expect(
        mainWindow.locator('[data-testid="create-workspace-submit-button"]')
      ).toBeDisabled()
    })

  })
})
