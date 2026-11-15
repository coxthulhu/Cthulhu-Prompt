import type { ElectronApplication, Page } from 'playwright'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { moveOsCursor } from '../helpers/OsCursorHelpers'
import { resolvePaletteColor } from '../helpers/PaletteHelpers'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import {
  PROMPT_COLLECTION_HOST_SELECTOR,
  promptEditorSelector,
  promptTreePromptSelector
} from '../helpers/PromptCollectionSelectors'
import { readWorkspaceState } from '../helpers/UserPersistenceHelpers'

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
  await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
  const started = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await started.testHelpers.setupWorkspaceViaUI()
  return started
}

/** Adds a New Tab and opens one collection from its tile. */
const openInNewTab = async (page: Page, collectionId: string): Promise<void> => {
  await page.getByTestId('new-tab-button').click()
  await page.getByTestId(`new-tab-collection-${collectionId}`).click()
}

/** Reads the work tabs saved on this machine as title and screen pairs. */
const readSavedTabs = async (electronApp: ElectronApplication): Promise<string[]> => {
  const { workTabs } = (await readWorkspaceState<{ workTabs: Array<{ title: string; screen: string }> }>(
    electronApp, null, 'application-machine', null
  ))!
  return workTabs.map((tab) => `${tab.title}:${tab.screen}`)
}

describe('Work Tab Collections', () => {
  test('opens collections in their tabs beside a title-only sidebar, returns to New Tab with Show All, and restores as New Tabs', async ({
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
    /** Top of the sidebar header's separator line. */
    const separatorTop = (await mainWindow.getByTestId('sidebar-header-separator').boundingBox())!.y
    /** Header bar holding the breadcrumb path, whose last pixel row is its bottom border. */
    const headerBarBox = (await mainWindow.locator('.prompt-collection-header-bar').boundingBox())!
    // Under 1px, so a separator one pixel row off fails while fractional rounding passes.
    expect(Math.abs(separatorTop - (headerBarBox.y + headerBarBox.height - 1))).toBeLessThan(1)

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

    // Tabs are saved as New Tabs, so they reopen on their New Tab screens with the selection kept.
    await expect.poll(() => readSavedTabs(electronApp)).toEqual(['New Tab:new-tab', 'New Tab:new-tab'])
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('app-activity-bar')).toBeVisible()
    await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
    await expect(getTabs(mainWindow)).toHaveText(['New Tab', 'New Tab'])
    await expect(getTabs(mainWindow).nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
  })

  test('selects the work tab already showing a clicked collection, whose tile is marked open', async ({ electronApp, testSetup }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    // Mouse closes read the OS cursor, which stays outside the window so held tab widths release at once.
    await moveOsCursor(electronApp, mainWindow, null)
    await openInNewTab(mainWindow, 'long-tasks')
    await mainWindow.getByTestId('new-tab-button').click()

    // Only the collection shown by another tab is marked open.
    await expect(mainWindow.getByTestId('new-tab-collection-long-tasks')).toHaveAttribute('data-open-in-tab', 'true')
    await expect(mainWindow.getByTestId('new-tab-collection-long-tasks')).toContainText('Open')
    await expect(mainWindow.getByTestId('new-tab-collection-short-tasks')).toHaveAttribute('data-open-in-tab', 'false')

    // Clicking it selects that tab instead of opening the collection again.
    await mainWindow.getByTestId('new-tab-collection-long-tasks').click()
    await expect(getTabs(mainWindow).nth(0)).toHaveAttribute('aria-selected', 'true')
    await expect(mainWindow.getByTestId('prompt-collection-screen')).toBeVisible()
    await expect(getTabs(mainWindow)).toHaveText(['Long Tasks', 'New Tab'])

    // The second tab stays on its New Tab screen.
    await getTabs(mainWindow).nth(1).click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()

    // Closing the tab showing the collection clears its open marker.
    await mainWindow.getByTestId('work-tab-close').nth(0).click()
    await expect(getTabs(mainWindow)).toHaveText(['New Tab'])
    await expect(mainWindow.getByTestId('new-tab-collection-long-tasks')).toHaveAttribute('data-open-in-tab', 'false')
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

  test('shares its collection scroll position and status group with the project screen', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await startWorkspace(testSetup)
    // The project shows the same collection before the tab opens it.
    await testHelpers.navigateToPromptCollections('Long Tasks')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('p0'))
    await openInNewTab(mainWindow, 'long-tasks')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('p0'))

    // Switching from the scrolled tab to the project shows the collection at the same scroll position.
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST_SELECTOR, 900)
    const scrollTop = await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR)
    expect(scrollTop).toBeGreaterThan(0)
    await mainWindow.getByTestId('nav-button-project').click()
    await expect(mainWindow.getByTestId('app-sidebar')).toHaveAttribute('data-sidebar-mode', 'project')
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('Long Tasks')
    // The project's title names the project, so it has no collection icon.
    await expect(mainWindow.getByTestId('sidebar-title-icon')).toHaveCount(0)
    await expect.poll(async () => Math.abs(await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR) - scrollTop))
      .toBeLessThanOrEqual(1)

    // A status group shown in the tab is the one the project screen shows.
    await getTabs(mainWindow).nth(0).click()
    await expect(mainWindow.getByTestId('app-sidebar')).toHaveAttribute('data-sidebar-mode', 'collection')
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Archived')
    await mainWindow.getByTestId('nav-button-project').click()
    await expect(mainWindow.getByTestId('app-sidebar')).toHaveAttribute('data-sidebar-mode', 'project')
    await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Archived')
    await expect(mainWindow.getByTestId('toggle-archived-prompts-button')).toHaveAttribute('data-active', 'true')
  })

  test('returns work tabs to their New Tab screen when their collection is deleted', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await startWorkspace(testSetup)
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

    // Deleting a collection on the project screen returns the background tab showing it to its New Tab screen.
    await openInNewTab(mainWindow, 'short-tasks')
    await testHelpers.navigateToPromptCollections('Short Tasks')
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('Short Tasks')
    await deleteSidebarCollection()
    await expect(getTabs(mainWindow)).toHaveText(['New Tab'])
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
    await expect(getTabs(mainWindow)).toHaveText(['New Tab'])
    await expect(mainWindow.getByTestId('new-tab-collection-long-tasks')).toHaveCount(0)
  })
})
