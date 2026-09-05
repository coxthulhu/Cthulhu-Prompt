import type { Page } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import {
  beginPromptTreeCategoryRowDrag,
  beginPromptTreeRowDrag,
  finishActiveDrag,
  moveActiveDragToTarget
} from '../helpers/PromptDragDropHelpers'
import type { CategoryOrder } from '../../src/shared/PromptFolder'
import { parsePromptMarkdown } from '../../src/main/Persistence/PromptFrontmatter'

/** Repository test fixtures and assertions for the Backlog workflow. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Stable workspace and root paths used to inspect persisted workflow changes. */
const WORKSPACE_PATH = '/ws/backlog'
/** Root containing shared categories and separate status directories. */
const ROOT_PATH = `${WORKSPACE_PATH}/Prompts/Work`

/** Builds an existing workspace whose Active category order differs from alphabetical order. */
const createBacklogWorkspace = () => {
  /** Existing prompts begin in Active, with no Backlog directory or order file. */
  const filesystem = createWorkspaceWithFolders(WORKSPACE_PATH, [{
    folderName: 'Work',
    displayName: 'Work',
    promptFolderId: 'backlog-root',
    prompts: ['first', 'second', 'third'].map((id) => ({
      id, title: id, promptText: `Work on ${id}`, category: 'alpha'
    }))
  }])
  for (const categoryId of ['alpha', 'beta']) {
    filesystem[`${ROOT_PATH}/Categories/${categoryId}.category.json`] = JSON.stringify({
      id: categoryId, displayName: categoryId, description: null
    })
  }
  filesystem[`${ROOT_PATH}/Active/_FolderInfo/FolderOrder.json`] = JSON.stringify({
    categories: [
      { categoryId: null, entries: [] },
      { categoryId: 'beta', entries: [] },
      {
        categoryId: 'alpha',
        entries: ['first', 'second', 'third'].map((id) => ({ kind: 'prompt', id }))
      }
    ]
  })
  return filesystem
}

/** Reads the authoritative order for one workflow, including empty categories. */
const readOrder = async (electronApp: ElectronApplication, group: 'Active' | 'Backlog'): Promise<CategoryOrder> =>
  JSON.parse(await readTextFile(electronApp, `${ROOT_PATH}/${group}/_FolderInfo/FolderOrder.json`))

/** Reads one category's persisted prompt IDs to distinguish append, prepend, and exact drops. */
const readEntries = async (
  electronApp: ElectronApplication,
  group: 'Active' | 'Backlog',
  categoryId = 'alpha'
): Promise<string[]> =>
  (await readOrder(electronApp, group)).categories.find((category) => category.categoryId === categoryId)!
    .entries.map((entry) => entry.id)

/** Changes workflow through the visible folder filter. */
const selectGroup = async (page: Page, group: 'active' | 'backlog' | 'completed') => {
  await page.locator(`[data-testid="prompt-folder-${group}-filter"]`).click()
}

/** Exercises the editor dropdown instead of bypassing its mutation callback. */
const selectStatus = async (page: Page, promptId: string, status: string) => {
  await page.locator(`${promptEditorSelector(promptId)} [data-testid="prompt-status-more-options-button"]`).click()
  await page.locator(`[data-testid="prompt-status-option-${status}"]`).click()
}

describe('Backlog prompts', () => {
  test('copies Active categories once and maintains independent ordering with shared category creation', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(createBacklogWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Window and helpers for a workspace created before Backlog existed. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Work')
    await expect.poll(() => readOrder(electronApp, 'Backlog')).toEqual({
      categories: [
        { categoryId: null, entries: [] },
        { categoryId: 'beta', entries: [] },
        { categoryId: 'alpha', entries: [] }
      ]
    })
    await expect(mainWindow.locator('[data-testid^="sidebar-prompt-status-accordion-section-"]')).toHaveCount(2)
    await expect(mainWindow.locator('[data-testid^="sidebar-prompt-status-accordion-section-"]').last())
      .toHaveAttribute('data-testid', 'sidebar-prompt-status-accordion-section-backlog')
    await expect(mainWindow.locator('[data-testid="toggle-backlog-prompts-button"]')).toHaveCount(0)
    /** Default expanded heights act as a 400:200 ratio before user resizing. */
    const activeHeight = await mainWindow.locator('[data-testid="sidebar-prompt-status-accordion-section-active"]')
      .evaluate((element) => element.getBoundingClientRect().height)
    /** Backlog receives half of Active's default expanded height. */
    const backlogHeight = await mainWindow.locator('[data-testid="sidebar-prompt-status-accordion-section-backlog"]')
      .evaluate((element) => element.getBoundingClientRect().height)
    expect(Math.abs(activeHeight - 2 * backlogHeight)).toBeLessThanOrEqual(2)

    await selectGroup(mainWindow, 'backlog')
    await beginPromptTreeCategoryRowDrag(mainWindow, 'alpha', 'backlog')
    await moveActiveDragToTarget(mainWindow, '[data-testid="prompt-tree-backlog-category-toggle-button-beta"]', 'top')
    await finishActiveDrag(mainWindow)
    await expect.poll(async () => (await readOrder(electronApp, 'Backlog')).categories.map((category) => category.categoryId))
      .toEqual([null, 'alpha', 'beta'])
    expect((await readOrder(electronApp, 'Active')).categories.map((category) => category.categoryId))
      .toEqual([null, 'beta', 'alpha'])

    await mainWindow.locator('[data-testid="sidebar-add-category-button"]').click()
    await mainWindow.locator('[data-testid="create-category-name-input"]').fill('new category')
    await mainWindow.locator('[data-testid="create-category-button"]').click()
    /** Shared category file supplies the generated ID inserted after Uncategorized in both groups. */
    const categoryPath = `${ROOT_PATH}/Categories/new category.category.json`
    await expect.poll(() => checkFileExists(electronApp, categoryPath)).toBe(true)
    /** Persisted category identity used to assert both independent orders. */
    const newCategory = JSON.parse(await readTextFile(electronApp, categoryPath)) as { id: string }
    await expect.poll(async () => (await readOrder(electronApp, 'Active')).categories.map((category) => category.categoryId))
      .toEqual([null, newCategory.id, 'beta', 'alpha'])
    await expect.poll(async () => (await readOrder(electronApp, 'Backlog')).categories.map((category) => category.categoryId))
      .toEqual([null, newCategory.id, 'alpha', 'beta'])

    // Reopen the workspace to exercise disk loading instead of only renderer hydration.
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Work')
    await expect.poll(async () => (await readOrder(electronApp, 'Backlog')).categories.map((category) => category.categoryId))
      .toEqual([null, newCategory.id, 'alpha', 'beta'])
    await expect(mainWindow.locator('[data-testid="prompt-tree-backlog-category-toggle-button-newcategory"]')).toBeVisible()
  })

  test('uses dropdown and quick-button ordering while retaining Backlog template selection and creation', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(createBacklogWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Window and navigation helpers for real editor transitions. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Work')
    /** Todo's Backlog action meets the selector's left edge. */
    const backlogButton = mainWindow.locator(`${promptEditorSelector('first')} [data-testid="prompt-backlog-button"]`)
    /** Left quick-action geometry verifies the direction of the transition control. */
    const backlogBox = await backlogButton.boundingBox()
    /** Todo selector geometry used to check the adjoining left quick action. */
    const todoStatusBox = await mainWindow.locator(`${promptEditorSelector('first')} [data-testid="prompt-status-pill"]`).boundingBox()
    expect(Math.abs(backlogBox!.x + backlogBox!.width - todoStatusBox!.x)).toBeLessThanOrEqual(2)
    await mainWindow.locator(`${promptEditorSelector('first')} [data-testid="prompt-status-more-options-button"]`).click()
    await expect(mainWindow.locator('[data-testid="prompt-status-more-options-menu"] .cthulhuUiDropdownPopupMoreOptionsTitle'))
      .toHaveText(['In Progress', 'Backlog', 'Complete'])
    await mainWindow.keyboard.press('Escape')
    await backlogButton.click()
    await selectStatus(mainWindow, 'second', 'backlog')
    await expect.poll(() => readEntries(electronApp, 'Backlog')).toEqual(['second', 'first'])
    await expect.poll(() => readEntries(electronApp, 'Active')).toEqual(['third'])
    await selectGroup(mainWindow, 'backlog')
    /** Backlog editor retains template selection while hiding both ways to copy. */
    const secondEditor = mainWindow.locator(promptEditorSelector('second'))
    await expect(secondEditor.locator('[data-testid="prompt-copy-button"]')).toHaveCount(0)
    await expect(secondEditor.locator('[data-testid="prompt-template-and-copy-button"]')).toHaveCount(0)
    await secondEditor.locator('[data-testid="prompt-template-button"]').click()
    await mainWindow.locator('[data-testid="prompt-template-option-none"]').click()
    await mainWindow.locator('[data-testid="prompt-template-confirm-button"]').click()
    await expect(secondEditor.locator('[data-testid="prompt-status-pill"]')).toHaveText('Backlog')
    await expect(secondEditor.locator('[data-testid="prompt-copy-button"]')).toHaveCount(0)
    await expect.poll(async () => parsePromptMarkdown(await readTextFile(electronApp, `${ROOT_PATH}/Backlog/second.prompt.md`)))
      .toMatchObject({ status: 'Backlog', category: 'alpha', templates: null })
    /** Right-hand quick action joins Active after its existing prompt. */
    const todoButton = secondEditor.locator('[data-testid="prompt-todo-button"]')
    /** Selector geometry verifies the quick action is on its right edge. */
    const statusBox = await secondEditor.locator('[data-testid="prompt-status-pill"]').boundingBox()
    /** Quick action geometry must meet the selector without a gap. */
    const todoBox = await todoButton.boundingBox()
    expect(Math.abs(statusBox!.x + statusBox!.width - todoBox!.x)).toBeLessThanOrEqual(2)
    await todoButton.click()
    await expect.poll(() => readEntries(electronApp, 'Active')).toEqual(['third', 'second'])
    await selectStatus(mainWindow, 'first', 'in-progress')
    await expect.poll(() => readEntries(electronApp, 'Active')).toEqual(['third', 'second', 'first'])
    await selectGroup(mainWindow, 'active')
    await selectStatus(mainWindow, 'third', 'in-progress')
    await selectStatus(mainWindow, 'third', 'todo')
    await expect.poll(() => readEntries(electronApp, 'Active')).toEqual(['third', 'second', 'first'])
    await selectStatus(mainWindow, 'second', 'completed')
    await selectGroup(mainWindow, 'completed')
    await mainWindow.locator(`${promptEditorSelector('second')} [data-testid="prompt-status-more-options-button"]`).click()
    await expect(mainWindow.locator('[data-testid="prompt-status-more-options-menu"] .cthulhuUiDropdownPopupMoreOptionsTitle'))
      .toHaveText(['Todo', 'In Progress', 'Backlog'])
    await mainWindow.locator('[data-testid="prompt-status-option-todo"]').click()
    await expect.poll(() => readEntries(electronApp, 'Active')).toEqual(['third', 'first', 'second'])

    await selectGroup(mainWindow, 'backlog')
    await mainWindow.locator('[data-testid="prompt-folder-divider-backlog-root-initial"] [data-testid="prompt-divider-add-initial"]').click()
    /** Creation in Backlog owns an Uncategorized entry and persists the Backlog status. */
    const createdEditor = mainWindow.locator('[data-testid^="prompt-editor-"]').filter({ has: mainWindow.locator('[data-testid="prompt-status-pill"]') })
    await expect(createdEditor.locator('[data-testid="prompt-status-pill"]')).toHaveText('Backlog')
    await createdEditor.locator('[data-testid="prompt-title"]').fill('Future work')
    await expect.poll(() => checkFileExists(electronApp, `${ROOT_PATH}/Backlog/Future work.prompt.md`)).toBe(true)
    await expect.poll(async () => parsePromptMarkdown(await readTextFile(electronApp, `${ROOT_PATH}/Backlog/Future work.prompt.md`)))
      .toMatchObject({ status: 'Backlog', title: 'Future work' })
  })

  test('persists exact drag positions and categories into, within, and out of Backlog', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(createBacklogWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Window and navigation helpers for simultaneous Active and Backlog trees. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Work')
    await beginPromptTreeRowDrag(mainWindow, 'first')
    await moveActiveDragToTarget(mainWindow, '[data-testid="prompt-tree-backlog-category-toggle-button-beta"]', 'bottom')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readEntries(electronApp, 'Backlog', 'beta')).toEqual(['first'])
    await beginPromptTreeRowDrag(mainWindow, 'second')
    await moveActiveDragToTarget(mainWindow, '[data-testid="prompt-tree-backlog-prompt-first"]', 'bottom')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readEntries(electronApp, 'Backlog', 'beta')).toEqual(['first', 'second'])
    await expect.poll(async () => parsePromptMarkdown(await readTextFile(electronApp, `${ROOT_PATH}/Backlog/second.prompt.md`)))
      .toMatchObject({ status: 'Backlog', category: 'beta' })
    await beginPromptTreeRowDrag(mainWindow, 'second', 'backlog')
    await moveActiveDragToTarget(mainWindow, '[data-testid="prompt-tree-backlog-prompt-first"]', 'top')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readEntries(electronApp, 'Backlog', 'beta')).toEqual(['second', 'first'])
    await beginPromptTreeRowDrag(mainWindow, 'first', 'backlog')
    await moveActiveDragToTarget(mainWindow, '[data-testid="prompt-tree-active-prompt-third"]', 'top')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readEntries(electronApp, 'Active')).toEqual(['first', 'third'])
    await expect.poll(() => readEntries(electronApp, 'Backlog', 'beta')).toEqual(['second'])
    await expect.poll(async () => parsePromptMarkdown(await readTextFile(electronApp, `${ROOT_PATH}/Active/first.prompt.md`)))
      .toMatchObject({ status: 'Todo', category: 'alpha' })
    // Reload the workspace from disk to verify Backlog status and ordering survive loading.
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Work')
    await mainWindow.locator('[data-testid="prompt-tree-backlog-prompt-second"]').click()
    await expect(mainWindow.locator(`${promptEditorSelector('second')} [data-testid="prompt-status-pill"]`)).toHaveText('Backlog')
    expect(await readEntries(electronApp, 'Active')).toEqual(['first', 'third'])
    expect(await readEntries(electronApp, 'Backlog', 'beta')).toEqual(['second'])
  })
})
