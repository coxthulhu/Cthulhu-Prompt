import type { ElectronApplication, Page } from 'playwright'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import { finishActiveDrag, moveActiveDragToTarget } from '../helpers/PromptDragDropHelpers'
import { expectPointerCapture, interruptPointerDrag, recordPointerId } from '../helpers/PointerCaptureHelpers'
import { readWorkspaceCollectionOrder, readWorkspaceState, runSqlQuery, runSqlStatement, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'
import { readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { selectedQuickCollectionSelector } from '../helpers/PromptCollectionSelectors'

/** Real Electron coverage exercises one favorites list shared by both collection kinds. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Four collections expose both favorite overflow and outside-selection pinning. */
const names = ['Alpha', 'Beta', 'Gamma', 'Omega']
/** Omega is a template collection so favorites mix both kinds. */
const id = (name: string): string => name === 'Omega' ? 'template-Omega' : `prompt-${name}`
/** Menu and scroll owner remain shared with existing collection reorder tests. */
const menuId = 'sidebar-prompt-collection-selector-menu'
/** Stable section-specific row identity avoids ambiguities for duplicated favorites. */
const rowSelector = (name: string, section = 'all'): string =>
  `[data-testid="sidebar-${section === 'all' ? 'prompt' : 'favorite'}-collection-dropdown-item-${id(name)}"]`
/** Both workspace fixtures reuse collection IDs to detect missing workspace scoping. */
const filesystem = (path: string) => ({
  ...createWorkspaceWithCollections(path, names.slice(0, 3).map((name) => ({ folderName: name, displayName: name, promptCollectionId: id(name) }))),
  ...createWorkspaceWithTemplateCollections(path, [{ folderName: 'Omega', displayName: 'Omega', collectionId: id('Omega') }])
})
/** Starts two independent workspaces and opens the default project. */
const start = async (testSetup: TestSetup, path: string) => {
  await testSetup.setupFilesystem({ ...filesystem(path), ...filesystem(`${path}-other`) })
  await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
  /** Shared UI helpers open the workspace and the project. */
  const started = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await started.testHelpers.setupWorkspaceViaUI()
  await started.testHelpers.navigateToPromptCollections('Alpha')
  await started.mainWindow.getByTestId('sidebar-prompt-collection-selector-trigger').click()
  return started
}
/** Reads SQLite independently of the optimistic renderer state. */
const favorites = async (app: ElectronApplication, path: string): Promise<string[]> =>
  (await readWorkspaceState<{ ids: string[] }>(app, createDeterministicId(path), 'collection-favorites',
    JSON.parse(await readTextFile(app, `${path}/DefaultProject/ProjectInfo.json`)).id))!.ids
/** Toggles either visible copy without selecting the collection. */
const toggle = async (page: Page, name: string, section = 'all'): Promise<void> => {
  await page.getByTestId(`sidebar-collection-favorite-${section}-${id(name)}`).click()
}
/** Stable row IDs assert order without relying on the shared button's internal label classes. */
const rowIds = async (page: Page, section: string): Promise<string[]> =>
  page.locator(`[data-dropdown-section="${section}"] [role="menuitem"]`).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')!))
/** Starts a real pointer drag while preserving the menu's stationary capture owner. */
const beginDrag = async (page: Page, selector: string): Promise<void> => {
  /** Geometry is measured after scrolling the source into view. */
  const row = page.locator(selector)
  await row.scrollIntoViewIfNeeded()
  /** Pointer motion crosses the production drag threshold. */
  const box = (await row.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8, { steps: 4 })
  await expect(page.locator('body')).toHaveCSS('cursor', 'grabbing')
}

describe('Collection favorites', () => {
  test(`favorites append, prioritize quick picks, persist privately, and clean up deletion`, async ({ testSetup, electronApp }) => {
    /** Stable workspace identity owns these private favorites. */
    const path = '/ws/favorites'
    /** Selection starts on Alpha, outside the first three favorites added below. */
    const { mainWindow: page, testHelpers } = await start(testSetup, path)
    /** Shared identity metadata must not change when favorites change. */
    const workspaceInfo = await readTextFile(electronApp, getWorkspaceInfoPath(path))
    /** Quick-row labels expose priority independently of dropdown rendering. */
    const quickLabels = page.locator('[data-testid^="sidebar-quick-collection-"] .sidebarPromptTreeSettingsLabel')
    await expect(page.getByText('Star a collection to pin it here.', { exact: true })).toBeVisible()
    await expect(page.locator('.cthulhuUiDropdownPopupDetailedSectionHeader')).toHaveText(['Favorites', 'All Collections'])
    await expect(page.locator('.cthulhuUiDropdownPopupDetailedSectionHeader').first()).toHaveCSS('text-transform', 'none')
    await toggle(page, 'Omega')
    await expect(quickLabels).toHaveText(['Omega', 'Alpha', 'Beta'])
    await toggle(page, 'Beta')
    await expect(quickLabels).toHaveText(['Omega', 'Beta', 'Alpha'])
    await toggle(page, 'Gamma')
    await toggle(page, 'Alpha')
    await expect(quickLabels).toHaveText(['Alpha', 'Omega', 'Beta'])
    await expect(page.locator(selectedQuickCollectionSelector)).toContainText('Alpha')
    await expect(page.getByTestId(menuId)).toBeVisible()
    await expect.poll(() => favorites(electronApp, path)).toEqual(['Omega', 'Beta', 'Gamma', 'Alpha'].map(id))
    await expect.poll(() => rowIds(page, 'all')).toEqual(names.map((name) => `sidebar-prompt-collection-dropdown-item-${id(name)}`))
    await page.locator(rowSelector('Omega', 'favorites')).click()
    await expect(quickLabels).toHaveText(['Omega', 'Beta', 'Gamma'])
    await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
    await toggle(page, 'Beta', 'favorites')
    await expect(page.getByTestId(`sidebar-collection-favorite-all-prompt-Beta`)).toHaveAttribute('aria-checked', 'false')
    await expect(quickLabels).toHaveText(['Omega', 'Gamma', 'Alpha'])
    // Keyboard activation appends a previously removed favorite to the end.
    await page.getByTestId(`sidebar-collection-favorite-all-prompt-Beta`).focus()
    await page.keyboard.press('Space')
    await expect.poll(() => favorites(electronApp, path)).toEqual(['Omega', 'Gamma', 'Alpha', 'Beta'].map(id))
    await expect(page.getByTestId(`sidebar-collection-favorite-favorites-prompt-Beta`)).toHaveAttribute('aria-checked', 'true')
    expect(await readTextFile(electronApp, getWorkspaceInfoPath(path))).toBe(workspaceInfo)
    expect((await runSqlQuery(electronApp, "SELECT DISTINCT storage_scope FROM workspace_state WHERE state_type = 'collection-favorites'")).rows).toEqual([{ storage_scope: 'user-specific' }])
    await page.keyboard.press('Escape')
    for (const target of [`${path}-other`, path]) {
      await testHelpers.navigateToHomeScreen()
      await testHelpers.clearWorkspaceViaUI()
      await testSetup.setupFileDialog([getWorkspaceInfoPath(target)])
      await testHelpers.setupWorkspaceViaUI()
      await page.getByTestId('nav-button-project').click()
      await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
      await expect.poll(() => rowIds(page, 'favorites')).toEqual(target === path
        ? ['Omega', 'Gamma', 'Alpha', 'Beta'].map((name) => `sidebar-favorite-collection-dropdown-item-${id(name)}`) : [])
      await page.keyboard.press('Escape')
    }
    await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
    await page.locator(rowSelector('Omega', 'favorites')).click()
    await page.getByTestId('selected-prompt-collection-actions-button').click()
    await page.getByTestId('delete-selected-prompt-collection-menu-item').click()
    // Empty collections delete immediately; persisted favorites must be removed in the same mutation.
    await expect.poll(() => favorites(electronApp, path)).toEqual(['Gamma', 'Alpha', 'Beta'].map(id))
    await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
    await expect(page.getByTestId(menuId)).toBeVisible()
    await expect(page.locator(rowSelector('Omega'))).toHaveCount(0)
    await expect(page.locator(rowSelector('Omega', 'favorites'))).toHaveCount(0)
  })

  test(`favorites reorder independently and reject cross-section or cancelled drags`, async ({ testSetup, electronApp }) => {
    /** A selected Alpha collection remains selected throughout all reorder operations. */
    const path = '/ws/favorite-drag'
    /** Both sections include the same three favorites in initially different orders. */
    const { mainWindow: page, testHelpers } = await start(testSetup, path)
    for (const name of ['Omega', 'Beta', 'Gamma']) await toggle(page, name)
    await beginDrag(page, rowSelector('Gamma', 'favorites'))
    await moveActiveDragToTarget(page, rowSelector('Omega', 'favorites'))
    await expect.poll(() => rowIds(page, 'favorites')).toEqual(['Gamma', 'Omega', 'Beta'].map((name) => `sidebar-favorite-collection-dropdown-item-${id(name)}`))
    expect(await favorites(electronApp, path)).toEqual(['Omega', 'Beta', 'Gamma'].map(id))
    await finishActiveDrag(page)
    await expect.poll(() => favorites(electronApp, path)).toEqual(['Gamma', 'Omega', 'Beta'].map(id))
    expect((await readWorkspaceCollectionOrder(electronApp, path))!.entries.map((entry) => entry.id)).toEqual(names.map(id))
    await beginDrag(page, rowSelector('Omega'))
    await moveActiveDragToTarget(page, rowSelector('Alpha'))
    await finishActiveDrag(page)
    await expect.poll(async () => (await readWorkspaceCollectionOrder(electronApp, path))!.entries.map((entry) => entry.id)).toEqual(['Omega', 'Alpha', 'Beta', 'Gamma'].map(id))
    for (const section of ['favorites', 'all']) {
      /** Cross-section releases must discard even a preceding valid preview. */
      const original = await rowIds(page, section)
      await beginDrag(page, rowSelector('Beta', section))
      await moveActiveDragToTarget(page, rowSelector(section === 'favorites' ? 'Gamma' : 'Omega', section))
      await expect.poll(() => rowIds(page, section)).not.toEqual(original)
      await moveActiveDragToTarget(page, rowSelector('Gamma', section === 'favorites' ? 'all' : 'favorites'))
      await finishActiveDrag(page)
      await expect.poll(() => rowIds(page, section)).toEqual(original)
    }
    for (const interruption of ['pointercancel', 'lostpointercapture'] as const) {
      /** Capture stays on the scroll owner while keyed rows move. */
      const owner = page.getByTestId(`${menuId}-items`)
      await recordPointerId(owner)
      await beginDrag(page, rowSelector('Beta', 'favorites'))
      /** The real browser pointer ID supports both cancellation variants. */
      const pointerId = await expectPointerCapture(owner)
      await moveActiveDragToTarget(page, rowSelector('Gamma', 'favorites'))
      await expect.poll(() => rowIds(page, 'favorites')).toEqual(['Beta', 'Gamma', 'Omega'].map((name) => `sidebar-favorite-collection-dropdown-item-${id(name)}`))
      await interruptPointerDrag(page, owner, pointerId, interruption)
      await page.mouse.up()
      await expect.poll(() => rowIds(page, 'favorites')).toEqual(['Gamma', 'Omega', 'Beta'].map((name) => `sidebar-favorite-collection-dropdown-item-${id(name)}`))
    }
    await expect(page.locator(selectedQuickCollectionSelector)).toContainText('Alpha')
    await page.keyboard.press('Escape')
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    await page.getByTestId('nav-button-project').click()
    await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
    await expect.poll(() => rowIds(page, 'favorites')).toEqual(['Gamma', 'Omega', 'Beta'].map((name) => `sidebar-favorite-collection-dropdown-item-${id(name)}`))
    await expect.poll(() => rowIds(page, 'all')).toEqual(['Omega', 'Alpha', 'Beta', 'Gamma'].map((name) => `sidebar-prompt-collection-dropdown-item-${id(name)}`))
  })

  test(`favorites repair stale IDs and roll back a failed SQLite save`, async ({ testSetup, electronApp }) => {
    /** Startup removes deleted and duplicated favorite references. */
    const path = '/ws/favorite-repair'
    await seedWorkspaceState(electronApp, createDeterministicId(path), 'collection-favorites', null, {
      ids: ['missing', 'template-Omega', 'template-Omega']
    })
    /** Existing preferences are loaded through the normal workspace query. */
    const { mainWindow: page } = await start(testSetup, path)
    expect(await favorites(electronApp, path)).toEqual([`template-Omega`])
    await runSqlStatement(electronApp, `CREATE TRIGGER reject_favorites BEFORE INSERT ON workspace_state
      WHEN NEW.state_type = 'collection-favorites' BEGIN SELECT RAISE(ABORT, 'Controlled favorites failure'); END`)
    await toggle(page, 'Beta')
    await expect.poll(() => testSetup.getRendererErrors().some((error) => error.message.includes('Controlled favorites failure'))).toBe(true)
    await expect(page.getByTestId(`sidebar-collection-favorite-all-prompt-Beta`)).toHaveAttribute('aria-checked', 'false')
    expect(await favorites(electronApp, path)).toEqual([`template-Omega`])
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_favorites')
    testSetup.removeRendererErrorsContaining('Controlled favorites failure')
    await toggle(page, 'Beta')
    await expect.poll(() => favorites(electronApp, path)).toEqual([`template-Omega`, `prompt-Beta`])
    await toggle(page, 'Omega', 'favorites')
    await toggle(page, 'Beta', 'favorites')
    await expect(page.getByText('Star a collection to pin it here.', { exact: true })).toBeVisible()
    await expect.poll(() => favorites(electronApp, path)).toEqual([])
  })
})
