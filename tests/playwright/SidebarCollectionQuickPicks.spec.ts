import { PromptStatus } from '@shared/domain/prompt/Prompt'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  promptCollectionSelectorDropdownItemSelector,
  promptCollectionSelectorMenuSelector,
  promptCollectionSelectorTriggerSelector,
  quickCollectionSelector,
  selectedQuickCollectionSelector
} from '../helpers/PromptCollectionSelectors'
import { beginPromptHandleDrag, beginPromptTreeRowDrag, finishActiveDrag, moveActiveDragToTarget } from '../helpers/PromptDragDropHelpers'
import { expectPersistedCollectionPromptIds } from '../helpers/PromptPersistenceTestHelpers'
import { readWorkspaceCollectionOrder } from '../helpers/UserPersistenceHelpers'

/** Real Electron coverage for collection selection, geometry, and direct content transfers. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Quick rows are distinct from the reorderable dropdown rows. */
const QUICK_ROWS = '[data-testid^="sidebar-quick-collection-"]'

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
      if (kind === 'prompt') await testHelpers.navigateToPromptCollections('Alpha')
      else await testHelpers.navigateToPromptTemplateCollections('Alpha')
      /** Visible quick rows preserve the ordinary tree row pitch. */
      const rows = mainWindow.locator(QUICK_ROWS)
      /** Label assertions ignore whitespace between the separate label and count spans. */
      const labels = rows.locator('.sidebarPromptTreeSettingsLabel')
      await expect(mainWindow.getByTestId('sidebar-collection-title')).toHaveText(
        kind === 'prompt' ? 'Task Collections' : 'Template Collections'
      )
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
      expect((await readWorkspaceCollectionOrder(electronApp, workspacePath, kind))!.entries.map((entry) => entry.id)).toEqual(names)

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
      await expect.poll(async () => (await readWorkspaceCollectionOrder(electronApp, workspacePath, kind))!.entries.map((entry) => entry.id))
        .toEqual(['Omega', 'Alpha', 'Beta', 'Gamma'])
    })

    test(`${kind} quick picks grow from empty to three without placeholder rows`, async ({ testSetup }) => {
      /** An empty workspace also verifies the separate Create Collection entry point remains. */
      const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
      if (kind === 'template') await mainWindow.getByTestId('nav-button-prompt-template-collections').click()
      await expect(mainWindow.getByTestId('sidebar-collection-title')).toHaveText(
        kind === 'prompt' ? 'Task Collections' : 'Template Collections'
      )
      await expect(mainWindow.locator(QUICK_ROWS)).toHaveCount(0)
      await expect(mainWindow.getByTestId('sidebar-prompt-collection-add-button')).toBeVisible()
      await expect(mainWindow.locator('.sidebarPromptTreeStatus')).toHaveText('Create a collection to get started.')
      // The first iteration opens the enabled Show All menu with only its creation footer.
      for (const count of [1, 2, 3]) {
        await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
        await expect(mainWindow.locator('[data-testid^="sidebar-prompt-collection-dropdown-item-"]')).toHaveCount(count - 1)
        await mainWindow.getByTestId('sidebar-prompt-collection-dropdown-add-item').click()
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
      if (kind === 'prompt') await testHelpers.navigateToPromptCollections('Source')
      else await testHelpers.navigateToPromptTemplateCollections('Source')
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
      const root = `${workspacePath}/${kind === 'prompt' ? 'Prompts' : 'Templates'}`
      await expectPersistedCollectionPromptIds(electronApp, `${root}/Source/Active/_CollectionInfo/CategoryOrder.json`, ['content'])
      await beginPromptTreeRowDrag(mainWindow, 'content', kind === 'prompt' ? 'active' : 'template')
      await moveActiveDragToTarget(mainWindow, quickCollectionSelector('target'))
      await expect(mainWindow.locator(quickCollectionSelector('target'))).toHaveAttribute('data-row-state', 'over')
      await expect(mainWindow.locator(promptCollectionSelectorMenuSelector)).toHaveCount(0)
      await finishActiveDrag(mainWindow)
      await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Source')
      await expect(mainWindow.locator(selectedQuickCollectionSelector).locator('.prompt-tree-row-count')).toHaveText(kind === 'prompt' ? '1' : '0')
      await expect(mainWindow.locator(quickCollectionSelector('target')).locator('.prompt-tree-row-count')).toHaveText('2')
      await expectPersistedCollectionPromptIds(electronApp, `${root}/Source/Active/_CollectionInfo/CategoryOrder.json`, [])
      await expectPersistedCollectionPromptIds(electronApp, `${root}/Target/Active/_CollectionInfo/CategoryOrder.json`, ['content', 'existing'])
      if (kind === 'prompt') {
        // Backlog transfers must retain their workflow instead of moving into Active.
        await beginPromptTreeRowDrag(mainWindow, 'backlog', 'backlog')
        await moveActiveDragToTarget(mainWindow, quickCollectionSelector('target'))
        await finishActiveDrag(mainWindow)
        await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Source')
        await expect(mainWindow.locator(quickCollectionSelector('target')).locator('.prompt-tree-row-count')).toHaveText('3')
        await expectPersistedCollectionPromptIds(electronApp, `${root}/Source/Backlog/_CollectionInfo/CategoryOrder.json`, [])
        await expectPersistedCollectionPromptIds(electronApp, `${root}/Target/Backlog/_CollectionInfo/CategoryOrder.json`, ['backlog'])
        await expectPersistedCollectionPromptIds(electronApp, `${root}/Target/Active/_CollectionInfo/CategoryOrder.json`, ['content', 'existing'])
      }
    })
  }
})
