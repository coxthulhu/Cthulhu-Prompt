import type { Page } from 'playwright'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { waitForMonacoEditor, setMonacoSelections } from '../helpers/MonacoHelpers'
import { resolvePaletteColor } from '../helpers/PaletteHelpers'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import {
  promptEditorSelector,
  promptTreePromptSelector
} from '../helpers/PromptCollectionSelectors'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { readTabSession } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

/** Workspace whose collections open in work tabs. */
const workspacePath = '/ws/work-tab-collections'
/** Full-screen editor shown while a prompt is open. */
const SINGLE_PROMPT_SCREEN = '[data-testid="single-prompt-screen"]'

/** Thirty multi-line prompts that scroll, a short task collection, and a template collection. */
const workspaceFiles = {
  ...createWorkspaceWithCollections(workspacePath, [
    {
      folderName: 'LongTasks', displayName: 'Long Tasks', promptCollectionId: 'long-tasks',
      prompts: Array.from({ length: 30 }, (_, index) => ({
        id: `p${index}`, title: `Prompt ${index}`, promptText: `Body ${index}\nSecond line\nThird line`
      }))
    },
    {
      folderName: 'ShortTasks', displayName: 'Short Tasks', promptCollectionId: 'short-tasks',
      prompts: [{ id: 'short-1', title: 'Short Prompt', promptText: 'Short body.' }]
    }
  ]),
  ...createWorkspaceWithTemplateCollections(workspacePath, [{
    folderName: 'Reviews', displayName: 'Reviews', collectionId: 'reviews',
    templates: [{ id: 'review-1', title: 'Review', templateText: 'Review [[PROMPT_TEXT]]' }]
  }])
}

/** Work tab body buttons in display order. */
const getTabs = (page: Page) => page.getByTestId('work-tab').getByRole('tab')

/** Opens the workspace on Home. */
const startWorkspace = async (testSetup: TestSetup) => {
  await testSetup.setupFilesystem(workspaceFiles)
  testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(workspacePath))
  const started = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await started.testHelpers.setupWorkspaceViaUI()
  return started
}

/** Adds a New Tab and opens one collection from its tile. */
const openInNewTab = async (page: Page, collectionId: string): Promise<void> => {
  if (!await page.getByTestId('new-tab-screen').isVisible()) await page.getByTestId('new-tab-button').click()
  await page.getByTestId(`new-tab-collection-${collectionId}`).click()
}

describe('Work Tab Collections', () => {
  test('opens collections in their tabs beside a title-only sidebar, returns to New Tab with Show All, and restores their collection locations', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    const sidebar = mainWindow.getByTestId('app-sidebar')
    const showAllButton = mainWindow.getByTestId('sidebar-show-all-button')

    // A tile opens its collection in the tab, which takes the collection's name and kind icon.
    await openInNewTab(mainWindow, 'long-tasks')
    await expect(mainWindow.getByTestId('prompt-collection-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('new-tab-screen')).toHaveCount(0)
    await expect(getTabs(mainWindow)).toHaveText(['Long Tasks'])
    await expect(getTabs(mainWindow).locator('svg')).toContainClass(['lucide-file-text'])

    // The sidebar holds only the collection's title and a New Tab icon Show All above the button bar and prompt tree.
    await expect(sidebar).toHaveAttribute('data-sidebar-mode', 'collection')
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Long Tasks')
    // The tab's kind icon leads the title, 8px before it like the tab's own icon.
    await expect(mainWindow.getByTestId('sidebar-title-icon')).toContainClass('lucide-file-text')
    /** Leading title icon and the title it precedes. */
    const titleIconBox = (await mainWindow.getByTestId('sidebar-title-icon').boundingBox())!
    const titleBox = (await mainWindow.getByTestId('sidebar-title').boundingBox())!
    expect(Math.abs(titleBox.x - (titleIconBox.x + titleIconBox.width) - 8)).toBeLessThanOrEqual(1)
    await expect(showAllButton).toHaveText('Show All')
    await expect(showAllButton.locator('svg')).toContainClass('lucide-layout-grid')
    for (const testId of ['sidebar-manage-projects-button', 'sidebar-prompt-collection-selector-trigger', 'sidebar-quick-collections-sash']) {
      await expect(mainWindow.getByTestId(testId)).toHaveCount(0)
    }
    await expect(mainWindow.locator('[data-testid^="sidebar-quick-collection-"]')).toHaveCount(0)
    for (const testId of ['sidebar-collection-overview-button', 'toggle-all-categories-button', 'selected-prompt-collection-actions-button']) {
      await expect(mainWindow.getByTestId(testId)).toBeVisible()
    }
    await expect(mainWindow.locator(promptTreePromptSelector('p0'))).toBeVisible()

    // The title names the collection in normal text, and the header's separator continues the bottom border of the
    // collection screen's header bar beside it.
    await expect(mainWindow.getByTestId('sidebar-title'))
      .toHaveCSS('color', await resolvePaletteColor(mainWindow.locator('body'), '--ui-normal-text'))
    const sidebarBox = (await sidebar.boundingBox())!
    const separatorBox = (await mainWindow.getByTestId('sidebar-header-separator').boundingBox())!
    const activeHeaderBox = (await mainWindow.getByTestId('sidebar-prompt-status-accordion-header-active').boundingBox())!
    const indicatorBox = (await sidebar.getByTestId('prompt-tree-status-indicator').first().boundingBox())!
    expect(indicatorBox.width).toBe(2)
    expect(indicatorBox.x - sidebarBox.x).toBe(2)
    for (const divider of [separatorBox, activeHeaderBox]) {
      expect(divider.x).toBe(sidebarBox.x)
      expect(divider.width).toBe(sidebarBox.width)
    }
    /** Header bar holding the breadcrumb path, whose last pixel row is its bottom border. */
    const headerBarBox = (await mainWindow.locator('.prompt-collection-header-bar').boundingBox())!
    // Under 1px, so a separator one pixel row off fails while fractional rounding passes.
    expect(Math.abs(separatorBox.y - (headerBarBox.y + headerBarBox.height - 1))).toBeLessThan(1)

    // Show All returns the tab to its New Tab screen, which hides the sidebar, and a tile opens the collection again.
    await showAllButton.click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(sidebar).toHaveCount(0)
    await expect(getTabs(mainWindow)).toHaveText(['New Tab'])
    await expect(getTabs(mainWindow).locator('svg')).toContainClass(['lucide-layout-grid'])
    await mainWindow.getByTestId('new-tab-collection-long-tasks').click()
    await expect(getTabs(mainWindow)).toHaveText(['Long Tasks'])

    // A template collection opens in another tab with the template icon, leaving the first tab as it was.
    await openInNewTab(mainWindow, 'reviews')
    await expect(getTabs(mainWindow)).toHaveText(['Long Tasks', 'Reviews'])
    await expect(getTabs(mainWindow).locator('svg')).toContainClass(['lucide-file-text', 'lucide-layers'])
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Reviews')
    await expect(mainWindow.getByTestId('sidebar-title-icon')).toContainClass('lucide-layers')

    // Switching between the two collection tabs swaps the sidebar and screen to each tab's collection.
    await getTabs(mainWindow).nth(0).click()
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Long Tasks')
    await expect(mainWindow.getByTestId('sidebar-title-icon')).toContainClass('lucide-file-text')
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('Long Tasks')
    await expect(mainWindow.locator(promptTreePromptSelector('p0'))).toBeVisible()
    await getTabs(mainWindow).nth(1).click()
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Reviews')
    await expect(mainWindow.getByTestId('sidebar-title-icon')).toContainClass('lucide-layers')
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('Reviews')

    // Saved identities reopen the actual collections and keep the selected tab.
    await expect.poll(async () => {
      /** The final selected collection must be committed before reloading. */
      const saved = (await readTabSession(electronApp, createDeterministicId(workspacePath))).user
      return [saved?.tabs.map((tab) => tab.collectionId), saved?.selectedTabId === saved?.tabs[1]?.id]
    }).toEqual([['long-tasks', 'reviews'], true])
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('nav-button-home')).toBeVisible()
    await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
    await expect(getTabs(mainWindow)).toHaveText(['Long Tasks', 'Reviews'])
    await expect(getTabs(mainWindow).nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('Reviews')
  })

  test('names its tab after the prompt open in its single-prompt editor and keeps it open across tab switches', async ({ testSetup }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    await openInNewTab(mainWindow, 'long-tasks')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('p0'))

    // Opening a prompt names the tab after it, keeping the collection's icon and sidebar.
    await mainWindow.locator(promptEditorSelector('p0')).getByTestId('prompt-open-button').click()
    await expect(mainWindow.locator(SINGLE_PROMPT_SCREEN)).toBeVisible()
    await expect(getTabs(mainWindow)).toHaveText(['Prompt 0'])
    await expect(getTabs(mainWindow).locator('svg')).toContainClass(['lucide-file-text'])
    await expect(mainWindow.getByTestId('app-sidebar')).toHaveAttribute('data-sidebar-mode', 'collection')
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Long Tasks')

    // Renaming the prompt renames the tab.
    await mainWindow.locator(SINGLE_PROMPT_SCREEN).getByTestId('prompt-title').fill('Renamed Prompt')
    await expect(getTabs(mainWindow)).toHaveText(['Renamed Prompt'])

    // The prompt stays open in its tab while another tab is shown.
    await mainWindow.getByTestId('new-tab-button').click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await getTabs(mainWindow).nth(0).click()
    await expect(mainWindow.locator(SINGLE_PROMPT_SCREEN)).toBeVisible()
    await expect(getTabs(mainWindow)).toHaveText(['Renamed Prompt', 'New Tab'])

    // Returning to the collection view names the tab after the collection again.
    await mainWindow.getByTestId('single-prompt-return-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-screen')).toBeVisible()
    await expect(getTabs(mainWindow)).toHaveText(['Long Tasks', 'New Tab'])
  })

  test('returns work tabs to their New Tab screen when their collection is deleted', async ({ testSetup, electronApp }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    /** Destructive confirmation for collections with content. */
    const confirmation = mainWindow.getByRole('dialog', { name: 'Delete Collection' })
    /** Deletes the sidebar's collection through its actions menu and confirmation. */
    const deleteSidebarCollection = async (): Promise<void> => {
      await mainWindow.getByTestId('selected-prompt-collection-actions-button').click()
      await mainWindow.getByTestId('delete-selected-prompt-collection-menu-item').click()
      await confirmation.getByRole('checkbox').check()
      await confirmation.getByTestId('prompt-collection-confirm-delete-button').click()
      await expect(confirmation).toHaveCount(0)
    }

    // Deleting a collection clears every tab showing it, including background tabs.
    await openInNewTab(mainWindow, 'short-tasks')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))
    await setMonacoSelections(mainWindow, promptEditorSelector('short-1'), [{ selectionStartLineNumber: 1, selectionStartColumn: 3, positionLineNumber: 1, positionColumn: 3 }])
    await mainWindow.getByTestId('new-tab-button').click()
    await mainWindow.getByTestId('new-tab-collection-short-tasks').click()
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('Short Tasks')
    await mainWindow.getByTestId('new-tab-button').click()
    await mainWindow.getByTestId('new-tab-collection-reviews').click()
    await waitForMonacoEditor(mainWindow, promptEditorSelector('review-1'))
    await setMonacoSelections(mainWindow, promptEditorSelector('review-1'), [{ selectionStartLineNumber: 1, selectionStartColumn: 4, positionLineNumber: 1, positionColumn: 4 }])
    await getTabs(mainWindow).nth(1).click()
    /** Unrelated collection state must survive both duplicate-tab cleanup and later deletion. */
    const workspaceId = createDeterministicId(workspacePath)
    await expect.poll(async () => (await readTabSession(electronApp, workspaceId)).user?.tabs.map((tab) => tab.collectionId)).toEqual(['short-tasks', 'short-tasks', 'reviews'])
    await expect.poll(async () => {
      /** Nonempty editor maps make the deletion and sibling assertions substantive. */
      const saved = await readTabSession(electronApp, workspaceId)
      return saved.user?.tabs.map((tab) => Object.keys(saved.machine?.tabs[tab.id].view.editorViewStates ?? {}))
    }).toEqual([['short-1'], ['short-1'], ['review-1']])
    /** Sibling view snapshot used to detect destructive session-wide cleanup. */
    const beforeDeletion = await readTabSession(electronApp, workspaceId)
    /** Portable and local state of the unrelated tab. */
    const sibling = { user: beforeDeletion.user!.tabs[2].view, machine: beforeDeletion.machine!.tabs[beforeDeletion.user!.tabs[2].id].view }
    await deleteSidebarCollection()
    await expect(getTabs(mainWindow)).toHaveText(['New Tab', 'New Tab', 'Reviews'])
    await expect.poll(async () => {
      /** Observe actual saved owners in both storage scopes after deletion. */
      const saved = await readTabSession(electronApp, workspaceId)
      return [saved.user?.tabs.map((tab) => tab.collectionId), saved.user?.lastClosedCollections['short-tasks'], saved.machine?.lastClosedCollections['short-tasks']]
    }).toEqual([[null, null, 'reviews'], undefined, undefined])
    /** Cleared tabs release editor maps while the unrelated collection keeps its choices. */
    const saved = await readTabSession(electronApp, workspaceId)
    expect(saved.user!.tabs[2].view).toEqual(sibling.user)
    expect(saved.machine!.tabs[saved.user!.tabs[2].id].view).toEqual(sibling.machine)
    for (const tab of saved.user!.tabs.slice(0, 2)) {
      expect(saved.machine!.tabs[tab.id].view.editorViewStates).toEqual({})
      expect(saved.machine!.tabs[tab.id].singlePromptEditorViewStates).toEqual({})
    }
    await getTabs(mainWindow).nth(0).click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('new-tab-collection-short-tasks')).toHaveCount(0)

    // Deleting a tab's own collection from its sidebar, even with a prompt open, returns the tab to its New Tab screen.
    await mainWindow.getByTestId('new-tab-collection-long-tasks').click()
    await waitForMonacoEditor(mainWindow, promptEditorSelector('p0'))
    await mainWindow.locator(promptEditorSelector('p0')).getByTestId('prompt-open-button').click()
    await expect(mainWindow.locator(SINGLE_PROMPT_SCREEN)).toBeVisible()
    await deleteSidebarCollection()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('app-sidebar')).toHaveCount(0)
    await expect(getTabs(mainWindow)).toHaveText(['New Tab', 'New Tab', 'Reviews'])
    await expect(mainWindow.getByTestId('new-tab-collection-long-tasks')).toHaveCount(0)
  })
})
