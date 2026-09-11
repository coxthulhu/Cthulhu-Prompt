import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { stubClipboard } from '../helpers/ClipboardHelpers'
import {
  createWorkspaceWithFolders,
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { PromptStatus } from '../../src/shared/Prompt'

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
      'Select a workspace to get started.'
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
    test('counts every prompt and folder type in the workspace statistics', async ({
      testSetup
    }) => {
      const workspacePath = '/ws/home-workspace-statistics'
      const filesystem = {
        ...createWorkspaceWithFolders(workspacePath, [
          {
            folderName: 'Tasks',
            displayName: 'Tasks',
            promptFolderId: 'home-task-folder',
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
        ...createWorkspaceWithTemplateFolders(workspacePath, [
          {
            folderName: 'Templates',
            displayName: 'Templates',
            folderId: 'home-template-folder',
            templates: [
              { id: 'home-template-one', title: 'Template One', templateText: 'First template' },
              { id: 'home-template-two', title: 'Template Two', templateText: 'Second template' }
            ]
          }
        ]),
        [workspaceFolderOrderPath(workspacePath)]: JSON.stringify({
          entries: [
            { kind: 'folder', id: 'home-task-folder' },
            { kind: 'folder', id: 'home-template-folder' }
          ]
        })
      }

      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await testHelpers.setupWorkspaceViaUI()

      const promptStat = mainWindow.locator('[data-testid="home-prompt-count-stat"]')
      await expect(promptStat.locator('.cthulhuUiTitle')).toHaveText('5')
      await expect(promptStat.locator('.cthulhuUiSubtitle')).toHaveText('Prompts')
      const promptFolderStat = mainWindow.locator(
        '[data-testid="home-prompt-folder-count-stat"]'
      )
      await expect(promptFolderStat.locator('.cthulhuUiTitle')).toHaveText('2')
      await expect(promptFolderStat.locator('.cthulhuUiSubtitle')).toHaveText('Prompt Folders')
    })

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

    test('migrates every unversioned workspace file once before opening', async ({
      electronApp,
      testSetup
    }) => {
      /** Version-zero workspace used to verify both compatibility migrations. */
      const workspacePath = '/ws/unversioned-migration'
      /** Current fixture structure downgraded below to the original workspace schema. */
      const filesystem = createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Examples',
          displayName: 'Examples',
          promptFolderId: 'migration-folder'
        }
      ])
      /** Workspace metadata path whose omitted version must be interpreted as zero. */
      const workspaceInfoPath = getWorkspaceInfoPath(workspacePath)
      /** Unversioned metadata derived from the otherwise current fixture. */
      const { schemaVersion: _schemaVersion, ...unversionedInfo } = JSON.parse(
        filesystem[workspaceInfoPath]!
      ) as { schemaVersion: number; workspaceId: string; workspaceName: string }
      filesystem[workspaceInfoPath] = JSON.stringify(unversionedInfo, null, 2)
      /** Unreferenced nested prompt carrying the retired singular template field. */
      const promptPath = `${workspacePath}/Prompts/Orphan/Nested/Legacy.prompt.md`
      filesystem[promptPath] = `---
id: legacy-prompt
createdAt: '2026-01-01T00:00:00.000Z'
title: Legacy Prompt
templateId: template-1
status: Todo
---
Keep this body.`
      /** Unreferenced nested category proving migration scans all matching workspace files. */
      const categoryPath = `${workspacePath}/Templates/Orphan/Nested.category.json`
      filesystem[categoryPath] = JSON.stringify({
        id: 'orphan-category',
        displayName: 'Orphan',
        description: null
      })

      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([workspaceInfoPath])
      /** Running application and UI helpers used to open the version-zero workspace twice. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
      /** Canonical workspace metadata committed only after all file migrations succeed. */
      const migratedInfoText = await readTextFile(electronApp, workspaceInfoPath)
      /** Canonical prompt source produced from the singular template reference. */
      const migratedPromptText = await readTextFile(electronApp, promptPath)
      /** Canonical unreferenced category data produced by the recursive scan. */
      const migratedCategoryText = await readTextFile(electronApp, categoryPath)
      expect(JSON.parse(migratedInfoText)).toEqual({
        schemaVersion: 1,
        workspaceId: unversionedInfo.workspaceId,
        workspaceName: unversionedInfo.workspaceName
      })
      expect(migratedPromptText).toContain('templates:\n  - id: template-1')
      expect(migratedPromptText).not.toContain('templateId:')
      expect(migratedPromptText).toContain('Keep this body.')
      expect(JSON.parse(migratedCategoryText)).toEqual({
        id: 'orphan-category',
        displayName: 'Orphan',
        shortDescription: null,
        description: null
      })

      await testHelpers.clearWorkspaceViaUI()
      await testSetup.setupFileDialog([workspaceInfoPath])
      expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
      expect(await readTextFile(electronApp, workspaceInfoPath)).toBe(migratedInfoText)
      expect(await readTextFile(electronApp, promptPath)).toBe(migratedPromptText)
      expect(await readTextFile(electronApp, categoryPath)).toBe(migratedCategoryText)
      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Failed to Open Workspace"]')
      ).toHaveCount(0)
    })

    test('accepts an explicit workspace schema version zero', async ({
      electronApp,
      testSetup
    }) => {
      /** Explicitly versioned legacy workspace accepted by the migration runner. */
      const workspacePath = '/ws/explicit-zero-migration'
      /** Empty version-zero workspace fixture requiring only the metadata migration. */
      const filesystem = createWorkspaceWithFolders(workspacePath, [], {
        settings: { schemaVersion: 0 }
      })
      /** Explicitly versioned workspace metadata selected through the open dialog. */
      const workspaceInfoPath = getWorkspaceInfoPath(workspacePath)

      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([workspaceInfoPath])
      /** Workspace helpers used to verify explicit zero reaches the ready state. */
      const { testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
      expect(JSON.parse(await readTextFile(electronApp, workspaceInfoPath)).schemaVersion).toBe(1)
    })

    test('leaves schema version zero when a workspace migration file is malformed', async ({
      electronApp,
      testSetup
    }) => {
      /** Version-zero workspace that must fail before committing its schema version. */
      const workspacePath = '/ws/failed-migration'
      /** Legacy fixture containing one category the migration cannot parse. */
      const filesystem = createWorkspaceWithFolders(workspacePath, [], {
        settings: { schemaVersion: 0 }
      })
      /** Legacy prompt converted before the later category failure interrupts migration. */
      const promptPath = `${workspacePath}/Prompts/Orphan/Legacy.prompt.md`
      filesystem[promptPath] = `---
id: partial-prompt
createdAt: '2026-01-01T00:00:00.000Z'
title: Partial Prompt
templateId: template-1
status: Todo
---
Keep this partial body.`
      /** Malformed matching category encountered by the recursive migration scan. */
      const categoryPath = `${workspacePath}/Prompts/Orphan/Broken.category.json`
      filesystem[categoryPath] = '{ malformed'
      /** Workspace metadata that must remain at zero after the failed step. */
      const workspaceInfoPath = getWorkspaceInfoPath(workspacePath)

      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([workspaceInfoPath])
      /** Running application used to observe the failed open operation. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })
      await mainWindow.click('[data-testid="open-workspace-button"]')

      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Failed to Open Workspace"]')
      ).toBeVisible()
      expect(await testHelpers.isWorkspaceReady()).toBe(false)
      expect(JSON.parse(await readTextFile(electronApp, workspaceInfoPath)).schemaVersion).toBe(0)
      /** Prompt text already migrated before failure and retained for the retry assertion. */
      const partiallyMigratedPromptText = await readTextFile(electronApp, promptPath)
      expect(partiallyMigratedPromptText).toContain('templates:\n  - id: template-1')
      expect(partiallyMigratedPromptText).not.toContain('templateId:')

      await mainWindow
        .locator(
          '[role="dialog"][aria-label="Failed to Open Workspace"] button.cthulhuUiActionButton'
        )
        .click()
      await testSetup.setupFileDialog([workspaceInfoPath])
      await mainWindow.click('[data-testid="open-workspace-button"]')
      await expect(
        mainWindow.locator('[role="dialog"][aria-label="Failed to Open Workspace"]')
      ).toBeVisible()
      expect(await readTextFile(electronApp, promptPath)).toBe(partiallyMigratedPromptText)
      expect(JSON.parse(await readTextFile(electronApp, workspaceInfoPath)).schemaVersion).toBe(0)
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
        '28px'
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
      electronApp,
      testSetup
    }) => {
      /** Running application and helpers used to create and inspect a new workspace. */
      const { testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-directory', autoSetup: false }
      })

      /** Successful UI creation result for the new workspace. */
      const setupResult = await testHelpers.createWorkspaceViaUI()
      expect(setupResult.setupDialogAppeared).toBe(true)
      expect(setupResult.workspaceReady).toBe(true)
      /** Created workspace root shown by the ready-state home screen. */
      const workspacePath = await testHelpers.getDisplayedWorkspacePath()
      expect(workspacePath).not.toBeNull()
      expect(
        JSON.parse(
          await readTextFile(
            electronApp,
            `${workspacePath}\\TestWorkspace.cthulhuprompt.json`
          )
        ).schemaVersion
      ).toBe(1)
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
        '28px'
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
      await expect(birthdayPromptTreeRow).toBeVisible()
      await expect(bundledFilesPromptTreeRow).toBeVisible()
      await categoryToggles.nth(0).click()
      await expect(birthdayPromptTreeRow).toHaveCount(0)
      await expect(bundledFilesPromptTreeRow).toHaveCount(0)
      await expect(mainWindow.locator('[data-testid^="prompt-tree-active-prompt-"]')).toHaveCount(0)

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
