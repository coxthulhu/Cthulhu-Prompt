import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import {
  readUserPersistence,
  readWorkspaceUiState,
  seedUserPersistence,
  seedWorkspaceUiState
} from '../helpers/UserPersistenceHelpers'

/** Shared Electron fixtures and assertions for the Welcome experience. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Welcome Dialog', () => {
  test('records first display before dismissal and stays dismissed after reload', async ({
    electronApp,
    testSetup
  }) => {
    expect((await readUserPersistence(electronApp)).hasShownWelcome).toBe(0)
    /** First launch retains the migrated SQLite default instead of seeding a returning user. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    /** Visible introduction whose persistence must not depend on closing it. */
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(welcome).toBeVisible()
    await expect(welcome.getByRole('heading', { level: 2 })).toHaveText([
      'Create a workspace',
      'Build a prompt template',
      'Add a prompt task',
      'Pick a template. Copy and go.'
    ])
    await expect(welcome.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0)
    await expect(welcome.locator('[data-testid="dialog-subtitle"]')).toHaveText(
      'Your first prompt, from workspace to clipboard.'
    )
    await expect(welcome.getByRole('listitem')).toHaveCount(4)
    await expect(welcome.getByRole('listitem').nth(1)).toContainText('Optional')
    await expect.poll(async () => (await readUserPersistence(electronApp)).hasShownWelcome).toBe(1)
    await expect(welcome).toBeVisible()
    await welcome.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(welcome).toHaveCount(0)
    await mainWindow.reload()
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="startup-loading-overlay"]')).toHaveCount(0)
    await expect(welcome).toHaveCount(0)
  })

  test('restores an existing workspace to Home for Welcome and then resumes normal screen restoration', async ({
    electronApp,
    testSetup
  }) => {
    /** Existing workspace with a previously selected non-Home screen. */
    const workspacePath = '/ws/welcome-existing'
    /** Disk fixture supplies the same workspace ID used by SQLite screen persistence. */
    const filesystem = createWorkspaceWithFolders(workspacePath, [])
    /** Workspace identity read from its on-disk metadata. */
    const { workspaceId } = JSON.parse(filesystem[getWorkspaceInfoPath(workspacePath)]!)
    await testSetup.setupFilesystem(filesystem)
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath),
      appSidebarWidthPx: 290
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'settings',
      selectedScreenData: null,
      promptFolderViewEntries: []
    })
    /** Startup must restore the workspace without immediately returning to Settings. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ firstLaunch: true })
    /** Welcome over the restored Home screen. */
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(welcome).toBeVisible()
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toHaveText(workspacePath)
    await expect(mainWindow.locator('[data-testid="show-welcome-button"]')).toBeVisible()
    await expect.poll(async () => await readUserPersistence(electronApp)).toEqual({
      lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath),
      appSidebarWidthPx: 290,
      hasShownWelcome: 1
    })
    await welcome.getByRole('button', { name: 'Close', exact: true }).click()
    await testHelpers.navigateToSettingsScreen()
    await expect.poll(async () => (await readWorkspaceUiState(electronApp, workspaceId)).selectedScreen).toBe('settings')
    await mainWindow.reload()
    await expect(mainWindow.locator('[data-testid="settings-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="startup-loading-overlay"]')).toHaveCount(0)
    await expect(welcome).toHaveCount(0)
  })

  test('reopens from Home, ignores outside clicks, and closes with Escape', async ({ testSetup }) => {
    /** Returning user can reopen the introduction without a workspace. */
    const { mainWindow } = await testSetup.setupAndStart()
    await mainWindow.locator('[data-testid="show-welcome-button"]').click()
    /** Dialog whose default dismissal behavior should match other application dialogs. */
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(welcome).toBeVisible()
    await mainWindow.mouse.click(5, 5)
    await expect(welcome).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await expect(welcome).toHaveCount(0)
  })

  test('closes before creating a workspace and completes the existing creation flow', async ({ testSetup }) => {
    await testSetup.setupFilesystem({ '/ws/welcome-create': null })
    await testSetup.setupFileDialog(['/ws/welcome-create'])
    /** First-launch user proceeds directly from Welcome to workspace creation. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    await mainWindow.locator('[data-testid="welcome-create-workspace-button"]').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })).toHaveCount(0)
    await expect(mainWindow.getByRole('dialog', { name: 'Create Workspace', exact: true })).toBeVisible()
    await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Welcome Workspace')
    await mainWindow.click('[data-testid="create-workspace-path-browse-button"]')
    await mainWindow.click('[data-testid="create-workspace-submit-button"]')
    await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="show-welcome-button"]')).toHaveCount(0)
  })

  test('keeps Welcome available before and after closing an existing workspace', async ({ testSetup }) => {
    /** Existing workspace offered by the native file picker. */
    const workspacePath = '/ws/welcome-open'
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, []))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** First-launch user chooses an existing workspace from Welcome. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ firstLaunch: true })
    await mainWindow.locator('[data-testid="welcome-open-workspace-button"]').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toHaveText(workspacePath)
    await mainWindow.locator('[data-testid="show-welcome-button"]').click()
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(welcome).toBeVisible()
    await welcome.getByRole('button', { name: 'Close', exact: true }).click()
    await testHelpers.clearWorkspaceViaUI()
    await mainWindow.locator('[data-testid="show-welcome-button"]').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })).toBeVisible()
  })

  test('stays closed when the workspace picker is canceled', async ({ testSetup }) => {
    await testSetup.setupFileDialog([])
    /** Canceling the native picker must not reopen the already dismissed Welcome dialog. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    await mainWindow.locator('[data-testid="welcome-open-workspace-button"]').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="open-workspace-button"]')).toBeEnabled()
    await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toHaveCount(0)
  })

  test('keeps content and actions reachable at the minimum window size', async ({ electronApp, testSetup }) => {
    /** Small supported window exercises the scrollable Welcome body. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    /** Native content dimensions exclude the window frame from the renderer target size. */
    const contentSize = await electronApp.evaluate(({ BrowserWindow }) => {
      /** Main window resized before reading its supported content dimensions. */
      const window = BrowserWindow.getAllWindows()[0]!
      window.setSize(800, 600)
      return window.getContentSize()
    })
    await expect.poll(async () => mainWindow.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual(contentSize)
    /** Dialog must fit inside the viewport without hiding its close or action buttons. */
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect.poll(async () => welcome.evaluate((element) => {
      /** Visible dialog bounds after the Electron resize reaches the renderer. */
      const bounds = element.getBoundingClientRect()
      return bounds.top >= -1 && bounds.bottom <= window.innerHeight + 1
    })).toBe(true)
    await expect(welcome.getByRole('button', { name: 'Close', exact: true })).toBeInViewport({ ratio: 1 })
    await expect(mainWindow.locator('[data-testid="welcome-create-workspace-button"]')).toBeInViewport({ ratio: 1 })
    await expect(mainWindow.locator('[data-testid="welcome-open-workspace-button"]')).toBeInViewport({ ratio: 1 })
    /** Shared row columns must stay aligned when descriptions and tips wrap. */
    const rows = welcome.getByRole('listitem')
    await expect(rows).toHaveCount(4)
    // Step index checks that all four numbers and their wrapped content remain reachable.
    for (let index = 0; index < 4; index += 1) {
      /** Current step is scrolled into view before checking its full content. */
      const row = rows.nth(index)
      await row.scrollIntoViewIfNeeded()
      await expect(row).toBeInViewport({ ratio: 1 })
      await expect(row.locator(':scope > span')).toHaveText(String(index + 1))
    }
    await expect.poll(async () => rows.evaluateAll((elements) => {
      /** Horizontal bounds reveal column drift and content overflowing the dialog body. */
      const bounds = elements.map((element) => ({
        number: element.firstElementChild!.getBoundingClientRect().left,
        title: element.querySelector('h2')!.getBoundingClientRect().left,
        description: element.querySelector('p')!.getBoundingClientRect().left,
        tip: element.querySelector('p')!.nextElementSibling!.getBoundingClientRect().left,
        overflows: element.scrollWidth > element.clientWidth + 1
      }))
      return bounds.every((row) =>
        Math.abs(row.number - bounds[0]!.number) <= 1 &&
        Math.abs(row.title - bounds[0]!.title) <= 1 &&
        Math.abs(row.description - bounds[0]!.description) <= 1 &&
        Math.abs(row.tip - row.description) <= 1 && !row.overflows
      )
    })).toBe(true)
    await welcome.getByRole('heading', { name: 'Pick a template. Copy and go.', exact: true }).scrollIntoViewIfNeeded()
    await expect(welcome.getByRole('heading', { name: 'Pick a template. Copy and go.', exact: true })).toBeInViewport()
    await expect(mainWindow.locator('[data-testid="welcome-create-workspace-button"]')).toBeInViewport({ ratio: 1 })
    await expect(mainWindow.locator('[data-testid="welcome-open-workspace-button"]')).toBeInViewport({ ratio: 1 })
  })
})
