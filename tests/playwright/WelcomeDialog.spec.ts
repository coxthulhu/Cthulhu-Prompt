import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import {
  readUserPersistence,
  readTabSession,
  runSqlQuery,
  seedUserPersistence,
  seedWorkspaceUiState
} from '../helpers/UserPersistenceHelpers'

/** Shared Electron fixtures and assertions for the Welcome experience. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Welcome Dialog', () => {
  test('opens the seeded Default Workspace on first launch and records Welcome before dismissal', async ({
    electronApp,
    testSetup
  }) => {
    expect((await readUserPersistence(electronApp)).hasShownWelcome).toBe(0)
    /** First launch retains the migrated SQLite default instead of seeding a returning user. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    /** Visible introduction whose persistence must not depend on closing it. */
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(welcome).toBeVisible()
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Prompts')
    expect((await runSqlQuery(electronApp, "SELECT COUNT(*) AS count FROM content.records WHERE kind = 'promptTemplate'")).rows)
      .toEqual([{ count: 3 }])
    await expect(welcome.getByRole('heading', { level: 2 })).toHaveText([
      'Make the workspace yours',
      'Build a prompt template',
      'Add a prompt task',
      'Pick a template. Copy and go.'
    ])
    await expect(welcome.getByRole('button', { name: 'Open My Prompts' })).toBeVisible()
    await expect(welcome.getByRole('button', { name: /workspace/i })).toHaveCount(0)
    await expect(welcome.locator('[data-testid="dialog-subtitle"]')).toHaveText(
      'Your first prompt, from workspace to clipboard.'
    )
    /** Walkthrough steps point first-time users to the controls and tabs they will see. */
    const steps = welcome.getByRole('listitem')
    await expect(steps).toHaveCount(4)
    await expect(steps.nth(0)).toContainText('rename the default workspace on Home, and rename its project and collections')
    await expect(steps.nth(0)).toContainText('tabs at the top to switch between open collections')
    await expect(steps.nth(0)).toContainText('open another prompt collection, click + (New Tab)')
    await expect(steps.nth(1)).toContainText('Optional')
    await expect(steps.nth(1)).toContainText('My Templates tab')
    await expect(steps.nth(2)).toContainText('My Prompts tab')
    await expect.poll(async () => (await readUserPersistence(electronApp)).hasShownWelcome).toBe(1)
    await expect(welcome).toBeVisible()
    /** Real profile path verifies the default went into the managed workspace folder. */
    const profile = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    expect((await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBe(join(profile, 'Workspaces', 'DefaultWorkspace.cthulhuprompt'))
    await welcome.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(welcome).toHaveCount(0)
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveText(['My Prompts', 'My Templates', 'My Routines'])
    await expect(mainWindow.getByRole('tab', { name: 'My Prompts', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveCount(3)
    await mainWindow.getByTestId('prompt-title').first().fill('My first edit')
    // Leaving the workspace flushes pending edits; opening it again checks persistence.
    await mainWindow.getByTestId('nav-button-home').click()
    await expect(mainWindow.getByTestId('home-primary-card')).toContainText('Default Workspace')
    await mainWindow.getByTestId('close-workspace-button').click()
    await expect(mainWindow.getByTestId('close-workspace-button')).toBeDisabled()
    await expect.poll(async () => (await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBeNull()
    await mainWindow.reload()
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="startup-loading-overlay"]')).toHaveCount(0)
    await expect(welcome).toHaveCount(0)
    await mainWindow.getByTestId('open-workspace-button').click()
    await mainWindow.getByRole('dialog', { name: 'Open Workspace' }).getByRole('button', { name: 'Default Workspace', exact: true }).click()
    await mainWindow.getByRole('tab', { name: 'My Prompts', exact: true }).click()
    await expect(mainWindow.getByTestId('prompt-title').first()).toHaveValue('My first edit')
  })

  test('shows Welcome over the remembered workspace screen and preserves it on Cancel', async ({
    electronApp,
    testSetup
  }) => {
    /** Existing workspace with a previously selected non-Home screen. */
    const workspacePath = '/ws/welcome-existing'
    /** Disk fixture supplies the same workspace ID used by SQLite screen persistence. */
    const filesystem = createWorkspaceWithCollections(workspacePath, [])
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
      promptCollectionViewEntries: []
    })
    /** Startup restores the saved screen even when Welcome has never been shown. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    /** Welcome over the restored Settings screen. */
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(welcome).toBeVisible()
    await expect(mainWindow.getByTestId('settings-screen')).toBeVisible()
    /** Only the remembered workspace should be present after automatic migration. */
    const profile = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    expect((await readdir(join(profile, 'Workspaces'))).filter((file) => file.endsWith('.cthulhuprompt'))).toEqual(['welcome-existing.cthulhuprompt'])
    await expect.poll(async () => await readUserPersistence(electronApp)).toEqual({
      lastWorkspaceInfoPath: join(profile, 'Workspaces', 'welcome-existing.cthulhuprompt'),
      appSidebarWidthPx: 290,
      hasShownWelcome: 1,
      settingsCollapsedSectionIds: [],
      settingsScrollTopPx: 0,
    })
    await welcome.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(mainWindow.getByTestId('settings-screen')).toBeVisible()
    await expect.poll(async () => (await readTabSession(electronApp, workspaceId)).user?.selectedTabId).toBe('settings')
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
    // A returning profile with an empty catalog stays empty on a real application launch.
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Open Workspace' })).toContainText('No workspaces available')
  })

  test('opens My Prompts from Home and reopens its collection when the tab was closed', async ({ testSetup }) => {
    /** New users start with all three starter collections open. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    /** Primary action reused on first launch and when reopened from Home. */
    const open = mainWindow.getByRole('button', { name: 'Open My Prompts', exact: true })
    await open.click()
    /** Work tab order distinguishes selection from opening a duplicate tab. */
    const tabs = mainWindow.getByTestId('work-tab').getByRole('tab')
    await mainWindow.getByTestId('nav-button-home').click()
    await mainWindow.getByTestId('show-welcome-button').click()
    await open.click()
    await expect(tabs).toHaveText(['My Prompts', 'My Templates', 'My Routines'])
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
    await mainWindow.getByTestId('work-tab-close').first().press('Enter')
    await expect(tabs).toHaveText(['My Templates', 'My Routines'])
    await mainWindow.getByTestId('nav-button-home').click()
    await mainWindow.getByTestId('show-welcome-button').click()
    await open.click()
    await expect(tabs).toHaveText(['My Templates', 'My Routines', 'My Prompts'])
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Prompts')
  })

  test('leaves a populated catalog alone and opens a New Tab if My Prompts is absent', async ({ testSetup, electronApp }) => {
    /** An existing managed workspace with no remembered selection. */
    const workspacePath = '/ws/welcome-open'
    await testSetup.setupFilesystem(createWorkspaceWithCollections(workspacePath, []))
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(workspacePath))
    /** Import before first launch so the managed catalog is already populated. */
    const name = await testSetup.prepareWorkspaceFixture()
    /** Welcome can still be read with no workspace open. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ firstLaunch: true })
    /** Dialog shared by startup and Home. */
    const welcome = mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })
    await expect(welcome).toBeVisible()
    await expect(welcome.getByTestId('welcome-open-tab-button')).toHaveCount(0)
    await welcome.getByRole('button', { name: 'Cancel' }).click()
    expect((await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBeNull()
    await mainWindow.getByTestId('open-workspace-button').click()
    /** The fixture must be visible before checking the populated catalog for an unwanted default. */
    const picker = mainWindow.getByRole('dialog', { name: 'Open Workspace' })
    await expect(picker.getByRole('button', { name, exact: true })).toBeVisible()
    await expect(picker.getByRole('button', { name: 'Default Workspace' })).toHaveCount(0)
    await picker.getByRole('button', { name, exact: true }).click()
    await expect(mainWindow.getByRole('dialog', { name: 'Welcome to Cthulhu Prompt', exact: true })).toHaveCount(0)
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await testHelpers.navigateToHomeScreen()
    await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toContainText(workspacePath.split('/').at(-1)! + '.cthulhuprompt')
    await mainWindow.locator('[data-testid="show-welcome-button"]').click()
    await welcome.getByRole('button', { name: 'Open New Tab' }).click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(2)
    await expect(mainWindow.getByTestId('work-tab').last()).toHaveAttribute('data-selected', 'true')
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
    await expect.poll(async () => welcome.locator('.cthulhuUiPopupSurface').evaluate((element) => {
      /** Visible dialog bounds after the Electron resize reaches the renderer. */
      const bounds = element.getBoundingClientRect()
      return bounds.top >= -1 && bounds.bottom <= window.innerHeight + 1
    })).toBe(true)
    await expect(welcome.getByRole('button', { name: 'Close', exact: true })).toBeInViewport({ ratio: 1 })
    await expect(welcome.getByRole('button', { name: 'Open My Prompts' })).toBeInViewport({ ratio: 1 })
    await expect(welcome.getByRole('button', { name: 'Cancel' })).toBeInViewport({ ratio: 1 })
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
    await expect(welcome.getByRole('button', { name: 'Open My Prompts' })).toBeInViewport({ ratio: 1 })
    await expect(welcome.getByRole('button', { name: 'Cancel' })).toBeInViewport({ ratio: 1 })
  })
})
