import type { ElectronApplication, Page } from 'playwright'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import { finishActiveDrag, moveActiveDragToTarget } from '../helpers/PromptDragDropHelpers'
import { expectPointerCapture, interruptPointerDrag, recordPointerId } from '../helpers/PointerCaptureHelpers'
import { readWorkspaceCollectionOrder, readWorkspaceState, runSqlQuery, runSqlStatement, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'
import { readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { selectedQuickCollectionSelector } from '../helpers/PromptCollectionSelectors'

/** Real Electron coverage exercises the same favorite UI for both collection kinds. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Collection kinds have independent private preference records. */
type Kind = 'prompt' | 'template'
/** Four collections expose both favorite overflow and outside-selection pinning. */
const names = ['Alpha', 'Beta', 'Gamma', 'Omega']
/** Menu and scroll owner remain shared with existing collection reorder tests. */
const menuId = 'sidebar-prompt-collection-selector-menu'
/** Stable section-specific row identity avoids ambiguities for duplicated favorites. */
const rowSelector = (kind: Kind, name: string, section = 'all'): string =>
  `[data-testid="sidebar-${section === 'all' ? 'prompt' : 'favorite'}-collection-dropdown-item-${kind}-${name}"]`
/** Both workspace fixtures reuse collection IDs to detect missing workspace scoping. */
const filesystem = (path: string) => ({
  ...createWorkspaceWithCollections(path, names.map((name) => ({ folderName: name, displayName: name, promptCollectionId: `prompt-${name}` }))),
  ...createWorkspaceWithTemplateCollections(path, names.map((name) => ({ folderName: name, displayName: name, collectionId: `template-${name}` })))
})
/** Starts two independent workspaces and selects the requested collection kind. */
const start = async (testSetup: TestSetup, kind: Kind, path: string) => {
  await testSetup.setupFilesystem({ ...filesystem(path), ...filesystem(`${path}-other`) })
  await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
  /** Shared UI helpers open the workspace and the appropriate activity. */
  const started = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await started.testHelpers.setupWorkspaceViaUI()
  if (kind === 'prompt') await started.testHelpers.navigateToPromptCollections('Alpha')
  else await started.testHelpers.navigateToPromptTemplateCollections('Alpha')
  await started.mainWindow.getByTestId('sidebar-prompt-collection-selector-trigger').click()
  return started
}
/** Reads SQLite independently of the optimistic renderer state. */
const favorites = async (app: ElectronApplication, path: string, kind: Kind): Promise<string[]> =>
  (await readWorkspaceState<{ ids: string[] }>(app, createDeterministicId(path), `${kind}-collection-favorites`, null))!.ids
/** Toggles either visible copy without selecting the collection. */
const toggle = async (page: Page, kind: Kind, name: string, section = 'all'): Promise<void> => {
  await page.getByTestId(`sidebar-collection-favorite-${section}-${kind}-${name}`).click()
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
  for (const kind of ['prompt', 'template'] as const) {
    test(`${kind} favorites append, prioritize quick picks, persist privately, and clean up deletion`, async ({ testSetup, electronApp }) => {
      /** Stable workspace identity owns these private favorites. */
      const path = `/ws/favorites-${kind}`
      /** Selection starts on Alpha, outside the first three favorites added below. */
      const { mainWindow: page, testHelpers } = await start(testSetup, kind, path)
      /** Shared identity metadata must not change when favorites change. */
      const workspaceInfo = await readTextFile(electronApp, getWorkspaceInfoPath(path))
      /** Quick-row labels expose priority independently of dropdown rendering. */
      const quickLabels = page.locator('[data-testid^="sidebar-quick-collection-"] .sidebarPromptTreeSettingsLabel')
      await expect(page.getByText('Star a collection to pin it here.', { exact: true })).toBeVisible()
      await expect(page.locator('.cthulhuUiDropdownPopupDetailedSectionHeader')).toHaveText(['Favorites', 'All Collections'])
      await expect(page.locator('.cthulhuUiDropdownPopupDetailedSectionHeader').first()).toHaveCSS('text-transform', 'none')
      await toggle(page, kind, 'Omega')
      await expect(quickLabels).toHaveText(['Omega', 'Alpha', 'Beta'])
      await toggle(page, kind, 'Beta')
      await expect(quickLabels).toHaveText(['Omega', 'Beta', 'Alpha'])
      await toggle(page, kind, 'Gamma')
      await toggle(page, kind, 'Alpha')
      await expect(quickLabels).toHaveText(['Alpha', 'Omega', 'Beta'])
      await expect(page.locator(selectedQuickCollectionSelector)).toContainText('Alpha')
      await expect(page.getByTestId(menuId)).toBeVisible()
      await expect.poll(() => favorites(electronApp, path, kind)).toEqual(['Omega', 'Beta', 'Gamma', 'Alpha'].map((name) => `${kind}-${name}`))
      await expect.poll(() => rowIds(page, 'all')).toEqual(names.map((name) => `sidebar-prompt-collection-dropdown-item-${kind}-${name}`))
      await page.locator(rowSelector(kind, 'Omega', 'favorites')).click()
      await expect(quickLabels).toHaveText(['Omega', 'Beta', 'Gamma'])
      await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
      await toggle(page, kind, 'Beta', 'favorites')
      await expect(page.getByTestId(`sidebar-collection-favorite-all-${kind}-Beta`)).toHaveAttribute('aria-checked', 'false')
      await expect(quickLabels).toHaveText(['Omega', 'Gamma', 'Alpha'])
      // Keyboard activation appends a previously removed favorite to the end.
      await page.getByTestId(`sidebar-collection-favorite-all-${kind}-Beta`).focus()
      await page.keyboard.press('Space')
      await expect.poll(() => favorites(electronApp, path, kind)).toEqual(['Omega', 'Gamma', 'Alpha', 'Beta'].map((name) => `${kind}-${name}`))
      await expect(page.getByTestId(`sidebar-collection-favorite-favorites-${kind}-Beta`)).toHaveAttribute('aria-checked', 'true')
      expect(await readTextFile(electronApp, getWorkspaceInfoPath(path))).toBe(workspaceInfo)
      expect((await runSqlQuery(electronApp, "SELECT DISTINCT storage_scope FROM workspace_state WHERE state_type LIKE '%-collection-favorites'")).rows).toEqual([{ storage_scope: 'user-specific' }])
      await page.keyboard.press('Escape')
      /** The other collection kind has its own empty favorites even in the same workspace. */
      const otherKind = kind === 'prompt' ? 'template' : 'prompt'
      await page.getByTestId(otherKind === 'prompt' ? 'nav-button-prompt-task-collections' : 'nav-button-prompt-template-collections').click()
      await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
      await expect(page.getByText('Star a collection to pin it here.', { exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      for (const target of [`${path}-other`, path]) {
        await testHelpers.navigateToHomeScreen()
        await testHelpers.clearWorkspaceViaUI()
        await testSetup.setupFileDialog([getWorkspaceInfoPath(target)])
        await testHelpers.setupWorkspaceViaUI()
        await page.getByTestId(kind === 'prompt' ? 'nav-button-prompt-task-collections' : 'nav-button-prompt-template-collections').click()
        await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
        await expect.poll(() => rowIds(page, 'favorites')).toEqual(target === path
          ? ['Omega', 'Gamma', 'Alpha', 'Beta'].map((name) => `sidebar-favorite-collection-dropdown-item-${kind}-${name}`) : [])
        await page.keyboard.press('Escape')
      }
      await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
      await page.locator(rowSelector(kind, 'Omega', 'favorites')).click()
      await page.getByTestId('selected-prompt-collection-actions-button').click()
      await page.getByTestId('delete-selected-prompt-collection-menu-item').click()
      // Empty collections delete immediately; persisted favorites must be removed in the same mutation.
      await expect.poll(() => favorites(electronApp, path, kind)).toEqual(['Gamma', 'Alpha', 'Beta'].map((name) => `${kind}-${name}`))
      await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
      await expect(page.getByTestId(menuId)).toBeVisible()
      await expect(page.locator(rowSelector(kind, 'Omega'))).toHaveCount(0)
      await expect(page.locator(rowSelector(kind, 'Omega', 'favorites'))).toHaveCount(0)
    })

    test(`${kind} favorites reorder independently and reject cross-section or cancelled drags`, async ({ testSetup, electronApp }) => {
      /** A selected Alpha collection remains selected throughout all reorder operations. */
      const path = `/ws/favorite-drag-${kind}`
      /** Both sections include the same three favorites in initially different orders. */
      const { mainWindow: page, testHelpers } = await start(testSetup, kind, path)
      for (const name of ['Omega', 'Beta', 'Gamma']) await toggle(page, kind, name)
      await beginDrag(page, rowSelector(kind, 'Gamma', 'favorites'))
      await moveActiveDragToTarget(page, rowSelector(kind, 'Omega', 'favorites'))
      await expect.poll(() => rowIds(page, 'favorites')).toEqual(['Gamma', 'Omega', 'Beta'].map((name) => `sidebar-favorite-collection-dropdown-item-${kind}-${name}`))
      expect(await favorites(electronApp, path, kind)).toEqual(['Omega', 'Beta', 'Gamma'].map((name) => `${kind}-${name}`))
      await finishActiveDrag(page)
      await expect.poll(() => favorites(electronApp, path, kind)).toEqual(['Gamma', 'Omega', 'Beta'].map((name) => `${kind}-${name}`))
      expect((await readWorkspaceCollectionOrder(electronApp, path, kind))!.entries.map((entry) => entry.id)).toEqual(names.map((name) => `${kind}-${name}`))
      await beginDrag(page, rowSelector(kind, 'Omega'))
      await moveActiveDragToTarget(page, rowSelector(kind, 'Alpha'))
      await finishActiveDrag(page)
      await expect.poll(async () => (await readWorkspaceCollectionOrder(electronApp, path, kind))!.entries.map((entry) => entry.id)).toEqual(['Omega', 'Alpha', 'Beta', 'Gamma'].map((name) => `${kind}-${name}`))
      for (const section of ['favorites', 'all']) {
        /** Cross-section releases must discard even a preceding valid preview. */
        const original = await rowIds(page, section)
        await beginDrag(page, rowSelector(kind, 'Beta', section))
        await moveActiveDragToTarget(page, rowSelector(kind, section === 'favorites' ? 'Gamma' : 'Omega', section))
        await expect.poll(() => rowIds(page, section)).not.toEqual(original)
        await moveActiveDragToTarget(page, rowSelector(kind, 'Gamma', section === 'favorites' ? 'all' : 'favorites'))
        await finishActiveDrag(page)
        await expect.poll(() => rowIds(page, section)).toEqual(original)
      }
      for (const interruption of ['pointercancel', 'lostpointercapture'] as const) {
        /** Capture stays on the scroll owner while keyed rows move. */
        const owner = page.getByTestId(`${menuId}-items`)
        await recordPointerId(owner)
        await beginDrag(page, rowSelector(kind, 'Beta', 'favorites'))
        /** The real browser pointer ID supports both cancellation variants. */
        const pointerId = await expectPointerCapture(owner)
        await moveActiveDragToTarget(page, rowSelector(kind, 'Gamma', 'favorites'))
        await expect.poll(() => rowIds(page, 'favorites')).toEqual(['Beta', 'Gamma', 'Omega'].map((name) => `sidebar-favorite-collection-dropdown-item-${kind}-${name}`))
        await interruptPointerDrag(page, owner, pointerId, interruption)
        await page.mouse.up()
        await expect.poll(() => rowIds(page, 'favorites')).toEqual(['Gamma', 'Omega', 'Beta'].map((name) => `sidebar-favorite-collection-dropdown-item-${kind}-${name}`))
      }
      await expect(page.locator(selectedQuickCollectionSelector)).toContainText('Alpha')
      await page.keyboard.press('Escape')
      await testHelpers.navigateToHomeScreen()
      await testHelpers.clearWorkspaceViaUI()
      await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
      await testHelpers.setupWorkspaceViaUI()
      await page.getByTestId(kind === 'prompt' ? 'nav-button-prompt-task-collections' : 'nav-button-prompt-template-collections').click()
      await page.getByTestId('sidebar-prompt-collection-selector-trigger').click()
      await expect.poll(() => rowIds(page, 'favorites')).toEqual(['Gamma', 'Omega', 'Beta'].map((name) => `sidebar-favorite-collection-dropdown-item-${kind}-${name}`))
      await expect.poll(() => rowIds(page, 'all')).toEqual(['Omega', 'Alpha', 'Beta', 'Gamma'].map((name) => `sidebar-prompt-collection-dropdown-item-${kind}-${name}`))
    })

    test(`${kind} favorites repair stale IDs and roll back a failed SQLite save`, async ({ testSetup, electronApp }) => {
      /** Startup removes deleted, duplicated, and wrong-kind favorite references. */
      const path = `/ws/favorite-repair-${kind}`
      await seedWorkspaceState(electronApp, createDeterministicId(path), `${kind}-collection-favorites`, null, {
        ids: ['missing', `${kind}-Omega`, `${kind}-Omega`, `${kind === 'prompt' ? 'template' : 'prompt'}-Alpha`]
      })
      /** Existing preferences are loaded through the normal workspace query. */
      const { mainWindow: page } = await start(testSetup, kind, path)
      expect(await favorites(electronApp, path, kind)).toEqual([`${kind}-Omega`])
      await runSqlStatement(electronApp, `CREATE TRIGGER reject_favorites BEFORE INSERT ON workspace_state
        WHEN NEW.state_type = '${kind}-collection-favorites' BEGIN SELECT RAISE(ABORT, 'Controlled favorites failure'); END`)
      await toggle(page, kind, 'Beta')
      await expect.poll(() => testSetup.getRendererErrors().some((error) => error.message.includes('Controlled favorites failure'))).toBe(true)
      await expect(page.getByTestId(`sidebar-collection-favorite-all-${kind}-Beta`)).toHaveAttribute('aria-checked', 'false')
      expect(await favorites(electronApp, path, kind)).toEqual([`${kind}-Omega`])
      await runSqlStatement(electronApp, 'DROP TRIGGER reject_favorites')
      testSetup.removeRendererErrorsContaining('Controlled favorites failure')
      await toggle(page, kind, 'Beta')
      await expect.poll(() => favorites(electronApp, path, kind)).toEqual([`${kind}-Omega`, `${kind}-Beta`])
      await toggle(page, kind, 'Omega', 'favorites')
      await toggle(page, kind, 'Beta', 'favorites')
      await expect(page.getByText('Star a collection to pin it here.', { exact: true })).toBeVisible()
      await expect.poll(() => favorites(electronApp, path, kind)).toEqual([])
    })
  }
})
