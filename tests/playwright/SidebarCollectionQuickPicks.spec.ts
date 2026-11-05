import type { ElectronApplication, Page } from '@playwright/test'
import { PromptStatus } from '@shared/domain/prompt/Prompt'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import {
  promptCollectionSelectorDropdownItemSelector,
  promptCollectionSelectorMenuSelector,
  promptCollectionSelectorTriggerSelector,
  quickCollectionSelector,
  selectedQuickCollectionSelector
} from '../helpers/PromptCollectionSelectors'
import { beginPromptHandleDrag, beginPromptTreeRowDrag, finishActiveDrag, moveActiveDragToTarget } from '../helpers/PromptDragDropHelpers'
import { expectPersistedCollectionPromptIds } from '../helpers/PromptPersistenceTestHelpers'
import { readUserPersistence, readWorkspaceCollectionOrder, seedUserPersistence } from '../helpers/UserPersistenceHelpers'

/** Real Electron coverage for collection selection, geometry, and direct content transfers. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Quick rows are distinct from the reorderable dropdown rows. */
const QUICK_ROWS = '[data-testid^="sidebar-quick-collection-"]'
/** Separator sash that sets how many quick rows are shown. */
const QUICK_SASH = 'sidebar-quick-collections-sash'
/** Distance between quick rows, which is also the sash's snap step. */
const ROW_PITCH_PX = 32

/** Opens a workspace with the requested number of task collections, after seeding a quick row count. */
const startWithCollections = async (
  testSetup: TestSetup,
  electronApp: ElectronApplication,
  collectionCount: number,
  sidebarQuickCollectionCount?: number
): Promise<Page> => {
  /** Workspace path named after its collection count. */
  const workspacePath = `/ws/quick-count-${collectionCount}`
  await testSetup.setupFilesystem(createWorkspaceWithCollections(workspacePath, Array.from({ length: collectionCount }, (_, index) => ({
    folderName: `C${index + 1}`, displayName: `C${index + 1}`, promptCollectionId: `C${index + 1}`,
    prompts: [{ id: `C${index + 1}-content`, title: `C${index + 1} content`, promptText: 'Task' }]
  }))))
  await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath), sidebarQuickCollectionCount })
  const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await testHelpers.assertWorkspaceReadyPath(workspacePath)
  await testHelpers.navigateToPromptCollections('C1')
  return mainWindow
}

/** Drags the quick row sash vertically from its center and releases it. */
const dragQuickSashBy = async (mainWindow: Page, deltaYPx: number): Promise<void> => {
  /** Current sash hitbox, which moves with the quick row count. */
  const sash = mainWindow.getByTestId(QUICK_SASH)
  const box = (await sash.boundingBox())!
  await mainWindow.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await mainWindow.mouse.down()
  // A missed press would otherwise only surface as an unchanged row count.
  await expect(sash).toHaveAttribute('data-dragging', 'true')
  await mainWindow.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + deltaYPx, { steps: 4 })
  await mainWindow.mouse.up()
  await expect(sash).toHaveAttribute('data-dragging', 'false')
}

describe('Sidebar collection quick picks', () => {
  for (const kind of ['prompt', 'template'] as const) {
    test(`${kind} quick picks retain selection and follow dropdown reordering`, async ({ testSetup, electronApp }) => {
      /** Four collections expose the selected-outside-the-baseline case. */
      const workspacePath = `/ws/quick-picks-${kind}`
      /** Ordered names also make unexpected duplicate or missing rows obvious. */
      const names = ['Alpha', 'Beta', 'Gamma', 'Omega']
      await testSetup.setupFilesystem(kind === 'prompt'
        ? createWorkspaceWithCollections(workspacePath, names.map((name) => ({
          folderName: name, displayName: name, promptCollectionId: name,
          prompts: [{ id: `${name}-content`, title: `${name} content`, promptText: 'Task' }]
        })))
        : createWorkspaceWithTemplateCollections(workspacePath, names.map((name) => ({
          folderName: name, displayName: name, collectionId: name,
          templates: [{ id: `${name}-content`, title: `${name} content`, templateText: 'Template' }]
        }))))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      /** Shared navigation selects the appropriate activity before assertions. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptCollections('Alpha')
      /** Visible quick rows preserve the ordinary tree row pitch. */
      const rows = mainWindow.locator(QUICK_ROWS)
      /** Label assertions ignore whitespace between the separate label and count spans. */
      const labels = rows.locator('.sidebarPromptTreeSettingsLabel')
      await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Default Project')
      await expect(labels).toHaveText(['Alpha', 'Beta', 'Gamma'])
      await expect(rows.locator('.prompt-tree-row-count')).toHaveText(['1', '1', '1'])
      await expect(rows.first().locator('svg')).toBeVisible()
      await expect(rows.first()).toHaveCSS('height', '30px')
      /** Row wrappers retain the tree's two pixels of vertical spacing. */
      const firstBox = (await rows.nth(0).boundingBox())!
      /** Second row measures the pitch independently from button height. */
      const secondBox = (await rows.nth(1).boundingBox())!
      expect(Math.abs(secondBox.y - firstBox.y - 32)).toBeLessThanOrEqual(1)

      // Keyboard selection of a baseline entry must retain its baseline position.
      await rows.nth(1).focus()
      await rows.nth(1).press('Enter')
      await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Beta')
      await expect(labels).toHaveText(['Alpha', 'Beta', 'Gamma'])
      await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Beta')
      await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
      await mainWindow.locator(promptCollectionSelectorDropdownItemSelector('Omega')).click()
      await expect(labels).toHaveText(['Omega', 'Alpha', 'Beta'])
      await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Omega')
      await mainWindow.locator(quickCollectionSelector('Alpha')).click()
      await expect(labels).toHaveText(['Alpha', 'Beta', 'Gamma'])

      // Pointer movement from quick rows must never start collection reordering.
      await rows.nth(1).hover()
      await mainWindow.mouse.down()
      await rows.nth(0).hover()
      await expect(mainWindow.locator('body')).not.toHaveCSS('cursor', 'grabbing')
      await mainWindow.mouse.up()
      expect((await readWorkspaceCollectionOrder(electronApp, workspacePath))!.entries.map((entry) => entry.id)).toEqual(names)

      await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
      /** Reorder only inside the full dropdown, retaining the selected Alpha collection. */
      const omega = mainWindow.locator(promptCollectionSelectorDropdownItemSelector('Omega'))
      await omega.hover()
      await mainWindow.mouse.down()
      await moveActiveDragToTarget(mainWindow, promptCollectionSelectorDropdownItemSelector('Alpha'))
      await expect(mainWindow.locator('body')).toHaveCSS('cursor', 'grabbing')
      await finishActiveDrag(mainWindow)
      await mainWindow.keyboard.press('Escape')
      await expect(labels).toHaveText(['Omega', 'Alpha', 'Beta'])
      await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Alpha')
      await expect.poll(async () => (await readWorkspaceCollectionOrder(electronApp, workspacePath))!.entries.map((entry) => entry.id))
        .toEqual(['Omega', 'Alpha', 'Beta', 'Gamma'])
    })

    test(`${kind} quick picks grow from empty to three without placeholder rows`, async ({ testSetup }) => {
      /** An empty workspace also verifies the separate Create Collection entry point remains. */
      const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
      await mainWindow.getByTestId('nav-button-project').click()
      await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Default Project')
      await expect(mainWindow.locator(QUICK_ROWS)).toHaveCount(0)
      await expect(mainWindow.getByTestId(QUICK_SASH)).toHaveCount(0)
      await expect(mainWindow.getByTestId('sidebar-prompt-collection-add-task-button')).toBeVisible()
      await expect(mainWindow.getByTestId('sidebar-prompt-collection-add-template-button')).toBeVisible()
      await expect(mainWindow.locator('.sidebarPromptTreeStatus')).toHaveText('Create a collection to get started.')
      // The first iteration opens the enabled Show All menu with only its creation footer.
      for (const count of [1, 2, 3]) {
        await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
        await expect(mainWindow.locator('[data-testid^="sidebar-prompt-collection-dropdown-item-"]')).toHaveCount(count - 1)
        await mainWindow.getByTestId(`sidebar-prompt-collection-dropdown-add-${kind === 'template' ? 'template' : 'task'}-item`).click()
        await mainWindow.getByTestId('create-prompt-collection-name-input').fill(`Collection ${count}`)
        await mainWindow.getByTestId('create-prompt-collection-button').click()
        await expect(mainWindow.locator(QUICK_ROWS)).toHaveCount(count)
        await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(`Collection ${count}`)
        await expect(mainWindow.locator(selectedQuickCollectionSelector).locator('.prompt-tree-row-count')).toHaveText('0')
      }
    })

    test(`${kind} quick rows accept direct content drops and reject the source collection`, async ({ testSetup, electronApp }) => {
      /** Both kinds exercise the same row component and persisted move path. */
      const workspacePath = `/ws/quick-drop-${kind}`
      await testSetup.setupFilesystem(kind === 'prompt'
        ? createWorkspaceWithCollections(workspacePath, [
          { folderName: 'Source', displayName: 'Source', promptCollectionId: 'source', prompts: [
            { id: 'content', title: 'Content', promptText: 'Move me' },
            { id: 'backlog', title: 'Later', promptText: 'Later' },
            { id: 'completed', title: 'Done', promptText: 'Done', status: PromptStatus.Completed }
          ] },
          { folderName: 'Target', displayName: 'Target', promptCollectionId: 'target', prompts: [
            { id: 'existing', title: 'Existing', promptText: 'Keep me' }
          ] }
        ])
        : createWorkspaceWithTemplateCollections(workspacePath, [
          { folderName: 'Source', displayName: 'Source', collectionId: 'source', templates: [
            { id: 'content', title: 'Content', templateText: 'Move me' }
          ] },
          { folderName: 'Target', displayName: 'Target', collectionId: 'target', templates: [
            { id: 'existing', title: 'Existing', templateText: 'Keep me' }
          ] }
        ]))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      /** Source remains selected throughout the move. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptCollections('Source')
      if (kind === 'prompt') {
        // The fixture builder seeds non-final prompts in Active; move this one into Backlog through the UI.
        await beginPromptTreeRowDrag(mainWindow, 'backlog')
        await moveActiveDragToTarget(mainWindow, '[data-testid="sidebar-prompt-status-accordion-header-backlog"]')
        await finishActiveDrag(mainWindow)
        await expect(mainWindow.getByTestId('prompt-tree-backlog-prompt-backlog')).toBeVisible()
      }
      await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Source')
      await expect(mainWindow.locator(selectedQuickCollectionSelector).locator('.prompt-tree-row-count')).toHaveText(kind === 'prompt' ? '2' : '1')
      if (kind === 'prompt') await beginPromptHandleDrag(mainWindow, 'content')
      else await beginPromptTreeRowDrag(mainWindow, 'content', 'template')
      await moveActiveDragToTarget(mainWindow, quickCollectionSelector('source'))
      await expect(mainWindow.locator(quickCollectionSelector('source'))).toHaveAttribute('data-row-state', 'blocked-over')
      await finishActiveDrag(mainWindow)
      /** Persisted Active order proves rejected drops did not remove the content. */
      const root = `${workspacePath}/DefaultProject/${kind === 'prompt' ? 'Prompts' : 'Templates'}`
      await expectPersistedCollectionPromptIds(electronApp, `${root}/Source/Active/_CategoryOrder.json`, ['content'])
      await beginPromptTreeRowDrag(mainWindow, 'content', kind === 'prompt' ? 'active' : 'template')
      await moveActiveDragToTarget(mainWindow, quickCollectionSelector('target'))
      await expect(mainWindow.locator(quickCollectionSelector('target'))).toHaveAttribute('data-row-state', 'over')
      await expect(mainWindow.locator(promptCollectionSelectorMenuSelector)).toHaveCount(0)
      await finishActiveDrag(mainWindow)
      await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Source')
      await expect(mainWindow.locator(selectedQuickCollectionSelector).locator('.prompt-tree-row-count')).toHaveText(kind === 'prompt' ? '1' : '0')
      await expect(mainWindow.locator(quickCollectionSelector('target')).locator('.prompt-tree-row-count')).toHaveText('2')
      await expectPersistedCollectionPromptIds(electronApp, `${root}/Source/Active/_CategoryOrder.json`, [])
      await expectPersistedCollectionPromptIds(electronApp, `${root}/Target/Active/_CategoryOrder.json`, ['content', 'existing'])
      if (kind === 'prompt') {
        // Backlog transfers must retain their workflow instead of moving into Active.
        await beginPromptTreeRowDrag(mainWindow, 'backlog', 'backlog')
        await moveActiveDragToTarget(mainWindow, quickCollectionSelector('target'))
        await finishActiveDrag(mainWindow)
        await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Source')
        await expect(mainWindow.locator(quickCollectionSelector('target')).locator('.prompt-tree-row-count')).toHaveText('3')
        await expectPersistedCollectionPromptIds(electronApp, `${root}/Source/Backlog/_CategoryOrder.json`, [])
        await expectPersistedCollectionPromptIds(electronApp, `${root}/Target/Backlog/_CategoryOrder.json`, ['backlog'])
        await expectPersistedCollectionPromptIds(electronApp, `${root}/Target/Active/_CategoryOrder.json`, ['content', 'existing'])
      }
    })
  }

  test('quick row sash snaps to whole rows between 1 and 10 and persists the count', async ({ testSetup, electronApp }) => {
    /** Twelve collections leave room above the ten-row maximum. */
    const mainWindow = await startWithCollections(testSetup, electronApp, 12)
    /** Quick collection rows whose count the sash controls. */
    const rows = mainWindow.locator(QUICK_ROWS)
    /** Separator sash under the last quick row. */
    const sash = mainWindow.getByTestId(QUICK_SASH)
    await expect(rows).toHaveCount(3)
    await expect(sash).toHaveAttribute('tabindex', '-1')

    // A partial row snaps back, and the sash stays aligned with the separator under the last row.
    await dragQuickSashBy(mainWindow, ROW_PITCH_PX * 0.4)
    await expect(rows).toHaveCount(3)
    await dragQuickSashBy(mainWindow, ROW_PITCH_PX * 2)
    await expect(rows).toHaveCount(5)
    /** Last quick row and the sash below it, measured after the snap. */
    const lastRowBox = (await rows.nth(4).boundingBox())!
    const sashBox = (await sash.boundingBox())!
    // The row wrapper's 1px bottom padding and the container's 4px bottom padding sit above the separator.
    expect(Math.abs(sashBox.y - (lastRowBox.y + lastRowBox.height + 5))).toBeLessThanOrEqual(1)
    await expect.poll(async () => (await readUserPersistence(electronApp)).sidebarQuickCollectionCount).toBe(5)

    // Dragging past either limit stops at ten rows or one row.
    await dragQuickSashBy(mainWindow, ROW_PITCH_PX * 6)
    await expect(rows).toHaveCount(10)
    await expect.poll(async () => (await readUserPersistence(electronApp)).sidebarQuickCollectionCount).toBe(10)
    await dragQuickSashBy(mainWindow, -ROW_PITCH_PX * 12)
    await expect(rows).toHaveCount(1)
    await expect.poll(async () => (await readUserPersistence(electronApp)).sidebarQuickCollectionCount).toBe(1)

    // With one row, selecting a hidden collection replaces the only quick row.
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    await mainWindow.locator(promptCollectionSelectorDropdownItemSelector('C5')).click()
    await expect(rows.locator('.sidebarPromptTreeSettingsLabel')).toHaveText(['C5'])
  })

  test('quick row count restores on startup and the sash stops at the collection count', async ({ testSetup, electronApp }) => {
    /** A saved count above the collection count shows every collection without changing the saved value. */
    const mainWindow = await startWithCollections(testSetup, electronApp, 4, 7)
    /** Quick collection rows whose count the sash controls. */
    const rows = mainWindow.locator(QUICK_ROWS)
    await expect(rows).toHaveCount(4)
    expect((await readUserPersistence(electronApp)).sidebarQuickCollectionCount).toBe(7)
    await dragQuickSashBy(mainWindow, -ROW_PITCH_PX)
    await expect(rows).toHaveCount(3)
    await dragQuickSashBy(mainWindow, ROW_PITCH_PX * 5)
    await expect(rows).toHaveCount(4)
    await expect.poll(async () => (await readUserPersistence(electronApp)).sidebarQuickCollectionCount).toBe(4)
  })
})
