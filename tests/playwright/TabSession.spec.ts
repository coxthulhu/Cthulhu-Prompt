import type { Page } from 'playwright'
import { createPlaywrightTestSuite, type PlaywrightTestFixtures } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { readTabSession, readWorkspaceState, runSqlQuery, runSqlStatement, seedUserPersistence, seedWorkspaceUiState } from '../helpers/UserPersistenceHelpers'
import { waitForMonacoEditor, setMonacoSelections, getMonacoCursorPosition } from '../helpers/MonacoHelpers'
import { getElementScrollTop } from '../helpers/VirtualWindowHelpers'

/** Integration coverage for the workspace-owned tab lifecycle. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Stable identities expose scope isolation directly in SQLite. */
const PATH = '/ws/tab-session'
/** Workspace identity shared by the fixture and persisted session. */
const ID = 'tab-session-workspace'
/** Main collection viewport whose saved position must be exact. */
const HOST = '[data-testid="prompt-collection-virtual-window"]'
/** Populated collection provides reachable positions in duplicate tabs. */
const files = createWorkspaceWithCollections(PATH, [{
  folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'tasks',
  prompts: Array.from({ length: 45 }, (_, index) => ({ id: `p${index}`, title: `Prompt ${index}`, promptText: 'First line\nSecond line\nThird line' }))
}], { settings: { workspaceId: ID } })

/** Starts on the automatically created New Tab screen. */
const start = async (testSetup: PlaywrightTestFixtures['testSetup']) => {
  await testSetup.setupFilesystem(files)
  testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(PATH))
  /** Electron session whose workspace is opened through the real picker. */
  const started = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await started.testHelpers.setupWorkspaceViaUI()
  return started
}

/** Title bar tab buttons in display order. */
const tabs = (page: Page) => page.getByTestId('work-tab').getByRole('tab')
/** Opens the collection in the current New Tab. */
const openTasks = async (page: Page): Promise<void> => {
  await page.getByTestId('new-tab-collection-tasks').click()
  await expect(page.getByTestId('prompt-collection-screen')).toBeVisible()
}
/** Verifies the visible scroll location within the repository's two-pixel tolerance. */
const expectOffset = async (page: Page, expected: number): Promise<void> => {
  await expect.poll(async () => Math.abs(await getElementScrollTop(page, HOST) - expected)).toBeLessThanOrEqual(2)
}
/** Reloads after the session autosave is observable in SQLite. */
const reload = async (page: Page): Promise<void> => {
  await page.reload()
  await expect(page.getByTestId('nav-button-home')).toBeVisible()
  await expect(page.getByTestId('startup-loading-overlay')).toHaveCount(0)
}

describe('Workspace tab sessions', () => {
  test('copies the most recently accessed collection tab and restores independent positions after reload', async ({ electronApp, testSetup }) => {
    /** Independent collection tabs share one workspace and its content. */
    const { mainWindow, testHelpers } = await start(testSetup)
    await openTasks(mainWindow)
    await testHelpers.scrollVirtualWindowTo(HOST, 210)
    await mainWindow.getByTestId('new-tab-button').click()
    await openTasks(mainWindow)
    await expectOffset(mainWindow, 210)
    await testHelpers.scrollVirtualWindowTo(HOST, 740)
    await tabs(mainWindow).nth(0).click()
    await expectOffset(mainWindow, 210)
    await mainWindow.getByTestId('new-tab-button').click()
    await openTasks(mainWindow)
    await expectOffset(mainWindow, 210)
    await testHelpers.scrollVirtualWindowTo(HOST, 1100)
    await expect.poll(async () => Object.values((await readTabSession(electronApp, ID)).machine?.tabs ?? {}).map((tab) => tab.view.scrollTopByMode.active)).toEqual([210, 740, 1100])
    await reload(mainWindow)
    await expect(tabs(mainWindow)).toHaveText(['Tasks', 'Tasks', 'Tasks'])
    await expect(tabs(mainWindow).nth(2)).toHaveAttribute('aria-selected', 'true')
    await expectOffset(mainWindow, 1100)
    await tabs(mainWindow).nth(1).click()
    await expectOffset(mainWindow, 740)
    await tabs(mainWindow).nth(0).click()
    await expectOffset(mainWindow, 210)
    await tabs(mainWindow).nth(1).click()
    await mainWindow.getByTestId('new-tab-button').click()
    await openTasks(mainWindow)
    await expectOffset(mainWindow, 740)
  })

  test('writes the last-closed snapshot only for the final collection view and excludes single-prompt tabs', async ({ electronApp, testSetup }) => {
    /** Collection and single-prompt tabs exercise both close rules. */
    const { mainWindow, testHelpers } = await start(testSetup)
    await openTasks(mainWindow)
    await testHelpers.scrollVirtualWindowTo(HOST, 250)
    await mainWindow.getByTestId('new-tab-button').click()
    await openTasks(mainWindow)
    await testHelpers.scrollVirtualWindowTo(HOST, 750)
    await tabs(mainWindow).nth(0).click()
    await mainWindow.getByTestId('sidebar-show-all-button').click()
    await expect.poll(async () => (await readTabSession(electronApp, ID)).user?.tabs[0].collectionId).toBeNull()
    // Migration seeds the initial default snapshot; closing a nonfinal view must leave it untouched.
    expect((await readTabSession(electronApp, ID)).machine?.lastClosedCollections.tasks.scrollTopByMode).toEqual({})
    await tabs(mainWindow).nth(1).click()
    await mainWindow.getByTestId('sidebar-show-all-button').click()
    await expect.poll(async () => (await readTabSession(electronApp, ID)).machine?.lastClosedCollections.tasks.scrollTopByMode.active).toBe(750)
    await openTasks(mainWindow)
    await expectOffset(mainWindow, 750)
    await testHelpers.scrollVirtualWindowTo(HOST, 0)
    await waitForMonacoEditor(mainWindow, '[data-testid="prompt-editor-p0"]')
    await mainWindow.getByTestId('prompt-editor-p0').getByTestId('prompt-open-button').click()
    await expect(mainWindow.getByTestId('single-prompt-screen')).toBeVisible()
    await expect.poll(async () => (await readTabSession(electronApp, ID)).machine?.lastClosedCollections.tasks.scrollTopByMode.active).toBe(0)
    await tabs(mainWindow).nth(0).click()
    await openTasks(mainWindow)
    await testHelpers.scrollVirtualWindowTo(HOST, 500)
    await mainWindow.getByTestId('sidebar-show-all-button').click()
    await expect.poll(async () => (await readTabSession(electronApp, ID)).machine?.lastClosedCollections.tasks.scrollTopByMode.active).toBe(500)
    await tabs(mainWindow).nth(1).click()
    await mainWindow.getByTestId('new-tab-button').click()
    await openTasks(mainWindow)
    await expectOffset(mainWindow, 500)
    await testHelpers.scrollVirtualWindowTo(HOST, 900)
    await mainWindow.getByTestId('work-tab-close').nth(2).press('Enter')
    await expect.poll(async () => (await readTabSession(electronApp, ID)).machine?.lastClosedCollections.tasks.scrollTopByMode.active).toBe(900)
    await tabs(mainWindow).nth(1).click()
    await mainWindow.getByTestId('single-prompt-return-button').click()
    await expectOffset(mainWindow, 0)
    expect(testSetup.getRendererErrors().filter((error) => error.message.includes("reading 'mode'"))).toEqual([])
  })

  test('restores a single prompt and all tabs after workspace close and reopen', async ({ electronApp, testSetup }) => {
    /** Real workspace lifecycle restores the same independently positioned tabs. */
    const { mainWindow, testHelpers } = await start(testSetup)
    await openTasks(mainWindow)
    await waitForMonacoEditor(mainWindow, '[data-testid="prompt-editor-p0"]')
    await mainWindow.getByTestId('prompt-editor-p0').getByTestId('prompt-open-button').click()
    await mainWindow.getByTestId('new-tab-button').click()
    await openTasks(mainWindow)
    await testHelpers.scrollVirtualWindowTo(HOST, 600)
    await expect.poll(async () => {
      /** Wait for both tabs and the latest viewport, not an earlier partial autosave. */
      const saved = await readTabSession(electronApp, ID)
      return [saved.user?.tabs.length, saved.user?.tabs[0].openPromptId, saved.user?.selectedTabId === saved.user?.tabs[1]?.id, saved.machine?.tabs[saved.user?.tabs[1]?.id ?? '']?.view.scrollTopByMode.active]
    }).toEqual([2, 'p0', true, 600])
    await reload(mainWindow)
    await expectOffset(mainWindow, 600)
    await tabs(mainWindow).nth(0).click()
    await expect(mainWindow.getByTestId('single-prompt-screen')).toBeVisible()
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await expect(tabs(mainWindow)).toHaveCount(0)
    expect((await readTabSession(electronApp, ID)).user?.tabs).toHaveLength(2)
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(PATH))
    await testHelpers.setupWorkspaceViaUI()
    await expect(tabs(mainWindow)).toHaveText(['Prompt 0', 'Tasks'])
    await tabs(mainWindow).nth(0).click()
    await expect(mainWindow.getByTestId('single-prompt-screen')).toBeVisible()
    await tabs(mainWindow).nth(1).click()
    await expectOffset(mainWindow, 600)
  })

  test('retains each New Tab search through Show All and reload while new tabs start empty', async ({ electronApp, testSetup }) => {
    /** Browser tabs retain separate searches while sharing their workspace. */
    const { mainWindow } = await start(testSetup)
    await mainWindow.getByTestId('new-tab-search-input').fill('Tasks')
    await openTasks(mainWindow)
    await mainWindow.getByTestId('sidebar-show-all-button').click()
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveValue('Tasks')
    await mainWindow.getByTestId('new-tab-button').click()
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveValue('')
    await mainWindow.getByTestId('new-tab-search-input').fill('missing')
    await expect.poll(async () => (await readTabSession(electronApp, ID)).user?.tabs.map((tab) => tab.search)).toEqual(['Tasks', 'missing'])
    await reload(mainWindow)
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveValue('missing')
    await tabs(mainWindow).nth(0).click()
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveValue('Tasks')
  })

  test('imports a project selection and retains failed conversion sources for retry', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(files)
    await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: getWorkspaceInfoPath(PATH) })
    await seedWorkspaceUiState(electronApp, { workspaceId: ID, selectedScreen: 'project', selectedScreenData: { promptCollectionId: 'tasks' },
      promptCollectionViewEntries: [{ contentOwnerId: 'tasks', selectedEntryId: 'p1', scrollTopByMode: { active: 240 } }] })
    await runSqlStatement(electronApp, "CREATE TRIGGER reject_tab_import BEFORE INSERT ON workspace_state WHEN NEW.state_type = 'tab-session-machine' BEGIN SELECT RAISE(ABORT, 'Tab import failure'); END")
    /** Startup attempts conversion while the injected SQLite failure is active. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    expect(await readWorkspaceState(electronApp, ID, 'collection-machine', 'tasks')).toEqual({ scrollTopByMode: { active: 240 } })
    expect((await readTabSession(electronApp, ID)).user).toBeNull()
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_tab_import')
    testSetup.removeRendererErrorsContaining('Tab import failure')
    testSetup.removeRendererErrorsContaining('Failed to migrate workspace tab session')
    await reload(mainWindow)
    await expect(tabs(mainWindow)).toHaveText(['Tasks'])
    await expectOffset(mainWindow, 240)
    expect(await readWorkspaceState(electronApp, ID, 'collection-machine', 'tasks')).toBeNull()
  })
  test('restores independent New Tab scroll positions through Show All, switching, and reload', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(createWorkspaceWithCollections(PATH, Array.from({ length: 80 }, (_, index) => ({
      folderName: `Collection${String(index).padStart(2, '0')}`, displayName: `Collection ${index}`, promptCollectionId: `collection-${index}`
    })), { settings: { workspaceId: ID } }))
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(PATH))
    /** Large native browser viewport, independent of the collection virtual scroller. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    /** Browser host is reused by the locator as its owning tab changes. */
    const browser = mainWindow.getByTestId('new-tab-screen')
    await mainWindow.getByTestId('new-tab-search-input').fill('Collection')
    await browser.evaluate((host) => { host.scrollTop = 300 })
    await expect.poll(() => browser.evaluate((host) => host.scrollTop)).toBe(300)
    /** Choose a fully visible tile so Playwright does not scroll before opening it. */
    const tileId = await browser.evaluate((host) => {
      /** Visible browser bounds used to exclude clipped tiles. */
      const bounds = host.getBoundingClientRect()
      return Array.from(host.querySelectorAll<HTMLElement>('[data-testid^="new-tab-collection-"]')).find((tile) => {
        /** Candidate tile must fit completely inside the native viewport. */
        const rect = tile.getBoundingClientRect()
        return rect.top >= bounds.top && rect.bottom <= bounds.bottom
      })!.dataset.testid!
    })
    await mainWindow.getByTestId(tileId).click()
    await mainWindow.getByTestId('sidebar-show-all-button').click()
    await expect.poll(() => browser.evaluate((host) => host.scrollTop)).toBe(300)
    await mainWindow.getByTestId('new-tab-button').click()
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveValue('')
    expect(await browser.evaluate((host) => host.scrollTop)).toBe(0)
    await browser.evaluate((host) => { host.scrollTop = 650 })
    await expect.poll(async () => Object.values((await readTabSession(electronApp, ID)).machine?.tabs ?? {}).map((tab) => tab.scrollTop)).toEqual([300, 650])
    await reload(mainWindow)
    await expect.poll(() => browser.evaluate((host) => host.scrollTop)).toBe(650)
    await tabs(mainWindow).first().click()
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveValue('Collection')
    await expect.poll(() => browser.evaluate((host) => host.scrollTop)).toBe(300)
    await mainWindow.getByTestId('new-tab-button').click()
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveValue('')
    expect(await browser.evaluate((host) => host.scrollTop)).toBe(0)
  })

  test('keeps tree, accordion, and editor locations independent in duplicate tabs', async ({ electronApp, testSetup }) => {
    /** Two collection tabs share content but own different cursor and sidebar locations. */
    const { mainWindow, testHelpers } = await start(testSetup)
    await openTasks(mainWindow)
    await waitForMonacoEditor(mainWindow, '[data-testid="prompt-editor-p0"]')
    await setMonacoSelections(mainWindow, '[data-testid="prompt-editor-p0"]', [{ selectionStartLineNumber: 2, selectionStartColumn: 4, positionLineNumber: 2, positionColumn: 4 }])
    /** Nondefault configured height detects accidental resets during viewport resizing. */
    const sash = (await mainWindow.getByTestId('sidebar-prompt-status-accordion-sash-backlog').boundingBox())!
    await mainWindow.mouse.move(sash.x + sash.width / 2, sash.y + sash.height / 2)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(sash.x + sash.width / 2, sash.y + sash.height / 2 + 40)
    await mainWindow.mouse.up()
    await mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog').click()
    await testHelpers.scrollVirtualWindowTo('[data-testid="prompt-tree-active-virtual-window"]', 350)
    await mainWindow.getByTestId('new-tab-button').click()
    await openTasks(mainWindow)
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog')).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => getElementScrollTop(mainWindow, '[data-testid="prompt-tree-active-virtual-window"]')).toBe(350)
    await waitForMonacoEditor(mainWindow, '[data-testid="prompt-editor-p0"]')
    await expect.poll(() => getMonacoCursorPosition(mainWindow, '[data-testid="prompt-editor-p0"]')).toEqual({ lineNumber: 2, column: 4 })
    await setMonacoSelections(mainWindow, '[data-testid="prompt-editor-p0"]', [{ selectionStartLineNumber: 3, selectionStartColumn: 2, positionLineNumber: 3, positionColumn: 2 }])
    await mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog').click()
    await testHelpers.scrollVirtualWindowTo('[data-testid="prompt-tree-active-virtual-window"]', 650)
    await tabs(mainWindow).first().click()
    await expect.poll(() => getElementScrollTop(mainWindow, '[data-testid="prompt-tree-active-virtual-window"]')).toBe(350)
    await expect.poll(() => getMonacoCursorPosition(mainWindow, '[data-testid="prompt-editor-p0"]')).toEqual({ lineNumber: 2, column: 4 })
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog')).toHaveAttribute('aria-expanded', 'false')
    await tabs(mainWindow).nth(1).click()
    await expect.poll(() => getElementScrollTop(mainWindow, '[data-testid="prompt-tree-active-virtual-window"]')).toBe(650)
    await expect.poll(() => getMonacoCursorPosition(mainWindow, '[data-testid="prompt-editor-p0"]')).toEqual({ lineNumber: 3, column: 2 })
    await expect.poll(async () => {
      /** Wait for the complete final selection and editor snapshots, not an earlier offset-only save. */
      const saved = await readTabSession(electronApp, ID)
      return {
        selectedSecond: saved.user?.selectedTabId === saved.user?.tabs[1]?.id,
        views: saved.user?.tabs.map((tab) => ({
          offset: saved.machine?.tabs[tab.id].view.treeScrollTopByMode.active,
          cursor: JSON.parse(saved.machine?.tabs[tab.id].view.editorViewStates.p0 ?? '{}').cursorState?.[0]?.position
        }))
      }
    }).toEqual({ selectedSecond: true, views: [
      { offset: 350, cursor: { lineNumber: 2, column: 4 } },
      { offset: 650, cursor: { lineNumber: 3, column: 2 } }
    ] })
    await reload(mainWindow)
    await expect.poll(() => getElementScrollTop(mainWindow, '[data-testid="prompt-tree-active-virtual-window"]')).toBe(650)
    await expect.poll(() => getMonacoCursorPosition(mainWindow, '[data-testid="prompt-editor-p0"]')).toEqual({ lineNumber: 3, column: 2 })
    /** Saved configured heights must not change when only the window geometry changes. */
    const beforeResize = (await readTabSession(electronApp, ID)).machine!
    await electronApp.evaluate(({ BrowserWindow }) => {
      /** Main Electron window supplies the sidebar's available height. */
      const window = BrowserWindow.getAllWindows()[0]!
      window.setContentSize(window.getContentSize()[0], 1000)
    })
    await expect.poll(() => mainWindow.evaluate(() => window.innerHeight)).toBe(1000)
    await tabs(mainWindow).first().click()
    await expect.poll(async () => (await readTabSession(electronApp, ID)).user?.selectedTabId).toBe((await readTabSession(electronApp, ID)).user!.tabs[0].id)
    await expect.poll(() => getElementScrollTop(mainWindow, '[data-testid="prompt-tree-active-virtual-window"]')).toBe(350)
    await expect.poll(() => getMonacoCursorPosition(mainWindow, '[data-testid="prompt-editor-p0"]')).toEqual({ lineNumber: 2, column: 4 })
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog')).toHaveAttribute('aria-expanded', 'false')
    expect(Object.values((await readTabSession(electronApp, ID)).machine!.tabs).map((tab) => tab.view.heights))
      .toEqual(Object.values(beforeResize.tabs).map((tab) => tab.view.heights))
  })

  test('preserves an intentionally empty session and classifies session storage scopes', async ({ electronApp, testSetup }) => {
    /** Closing the final work tab is distinct from opening a previously unseen workspace. */
    const { mainWindow } = await start(testSetup)
    await mainWindow.getByTestId('work-tab-close').press('Enter')
    await expect.poll(async () => (await readTabSession(electronApp, ID)).user?.tabs).toEqual([])
    await reload(mainWindow)
    await expect(tabs(mainWindow)).toHaveCount(0)
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    /** Storage classification is asserted against raw SQL, independently of the production adapter. */
    const rows = await runSqlQuery(electronApp, `SELECT state_type, storage_scope FROM workspace_state WHERE workspace_id = '${ID}' AND state_type LIKE 'tab-session-%' ORDER BY state_type`)
    expect(rows.rows).toEqual([
      { state_type: 'tab-session-machine', storage_scope: 'machine-specific' },
      { state_type: 'tab-session-user', storage_scope: 'user-specific' }
    ])
  })

})
