import { readRecord, readOrder } from '../helpers/WorkspaceDatabaseHelpers'
import { waitForRendererPersistence } from '../helpers/RendererCompletionHelpers'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { promptEditorSelector } from '../helpers/PromptCollectionSelectors'
import {
  beginPromptTreeRowDrag,
  finishActiveDrag,
  moveActiveDragToTarget
} from '../helpers/PromptDragDropHelpers'
import { getPromptEditorIds, openManageCategoriesFromSidebar } from '../helpers/PromptCollectionHelpers'
import { stubClipboard } from '../helpers/ClipboardHelpers'

/** Electron integration suite exercises persisted archive transfers and selection behavior. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Workspace shared by the independently launched regression scenarios. */
const WORKSPACE_PATH = '/ws/template-archive'
/** Original template identity must survive migration, archive, and restoration. */
const TEMPLATE_ID = 'archive-template'

/** Builds categorized templates plus a task that already references the first template. */
const createArchiveWorkspace = (): Record<string, string | null> => {
  /** Task fixture retains a selected template across its archive transition. */
  const tasks = createWorkspaceWithCollections(WORKSPACE_PATH, [{
    folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'archive-tasks',
    prompts: [
      { id: 'archive-task', title: 'Task', promptText: 'Body', templates: [{ id: TEMPLATE_ID }] },
      { id: 'archive-quick-task', title: 'Quick Task', promptText: 'Quick body' }
    ]
  }])
  /** Template fixture includes a predecessor to verify restoration at the category top. */
  const templates = createWorkspaceWithTemplateCollections(WORKSPACE_PATH, [{
    folderName: 'Library', displayName: 'Library', collectionId: 'archive-library',
    description: 'Keep root description',
    categories: [{ categoryName: 'Code', displayName: 'Code', categoryId: 'archive-category', templates: [
      { id: 'archive-predecessor', title: 'Other', templateText: 'Other [[PROMPT_TEXT]]' },
      { id: TEMPLATE_ID, title: 'Wrapper', templateText: 'Wrapped [[PROMPT_TEXT]]' }
    ] }]
  }])
  return { ...tasks, ...templates }
}

describe('Template archive', () => {
  test('archives, restores at the category top, and drags templates between status sections', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(createArchiveWorkspace())
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(WORKSPACE_PATH))
    /** Shared editor remains addressable as its status changes. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Library')
    /** Populated template defaults to Archive without a confirmation dialog. */
    const editor = mainWindow.locator(promptEditorSelector(TEMPLATE_ID))
    await expect(editor.getByTestId('prompt-title-status-indicator')).toHaveAttribute('data-status', 'Active')
    await editor.getByTestId('prompt-archive-button').click()
    await expect.poll(() => readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Archived')).toBe(true)
    expect(await readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Active')).toBe(false)
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-active-filter')).toContainText('Active 1')
    await expect(mainWindow.getByTestId('prompt-collection-archived-filter')).toContainText('Archived 1')
    await expect(mainWindow.getByTestId('prompt-collection-completed-filter')).toHaveCount(0)
    await expect(mainWindow.getByTestId('toggle-completed-prompts-button')).toHaveCount(0)
    await expect(editor.getByTestId('template-restore-button')).toBeVisible()
    await expect(editor.getByTestId('prompt-title-status-indicator')).toHaveAttribute('data-status', 'Archived')
    await expect(editor.getByTestId('prompt-delete-more-options-button')).toHaveCount(0)
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-section-backlog')).toHaveCount(0)
    await editor.getByTestId('template-restore-button').click()
    await expect.poll(() => readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Active')).toBe(true)
    await expect.poll(async () => (await readOrder(electronApp, 'archive-library')).categories[1].entries.map((entry: { id: string }) => entry.id)).toEqual([TEMPLATE_ID, 'archive-predecessor'])
    await beginPromptTreeRowDrag(mainWindow, TEMPLATE_ID, 'template')
    await moveActiveDragToTarget(mainWindow, '[data-testid="sidebar-prompt-status-accordion-header-archived"]')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Archived')).toBe(true)
    await beginPromptTreeRowDrag(mainWindow, TEMPLATE_ID, 'archived')
    await moveActiveDragToTarget(mainWindow, '[data-testid="sidebar-prompt-status-accordion-header-active"]')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Active')).toBe(true)
    expect(await readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Archived')).toBe(false)
    await mainWindow.getByTestId('prompt-collection-active-filter').click()
    await expect(editor.getByTestId('prompt-title-status-indicator')).toHaveAttribute('data-status', 'Active')
    await editor.getByTestId('prompt-archive-button').click()
    await mainWindow.getByTestId('prompt-collection-archived-filter').click()
    await editor.getByTestId('prompt-delete-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Delete Template' })).toBeVisible()
    await mainWindow.getByTestId('prompt-confirm-delete-button').click()
    await expect.poll(() => readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Archived')).toBe(false)
  })

  test('hides archived choices while preserving unchanged selection and copied output', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(createArchiveWorkspace())
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(WORKSPACE_PATH))
    /** Task and template views share the same loaded authoritative template identity. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Library')
    await mainWindow.locator(promptEditorSelector(TEMPLATE_ID)).getByTestId('prompt-archive-button').click()
    await expect.poll(() => readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Archived')).toBe(true)
    await waitForRendererPersistence(mainWindow)
    await mainWindow.reload()
    await testHelpers.navigateToPromptCollections('Tasks')
    await stubClipboard(mainWindow)
    /** Existing task reference stays selected despite being unavailable in the picker. */
    const editor = mainWindow.locator(promptEditorSelector('archive-task'))
    await editor.getByTestId('prompt-template-button').click()
    /** Full selector must neither expose the archived template nor imply No template. */
    const dialog = mainWindow.getByRole('dialog', { name: 'Select Template', exact: true })
    await expect(dialog.getByTestId(`prompt-tree-template-prompt-${TEMPLATE_ID}`)).toHaveCount(0)
    await expect(dialog.getByTestId('prompt-template-option-none')).toHaveAttribute('aria-pressed', 'false')
    await expect(dialog.locator('.sidebarPromptTreeSettingsButton[data-row-state="active"]')).toHaveCount(0)
    await dialog.getByTestId('prompt-template-confirm-button').click()
    await editor.getByTestId('prompt-copy-button').click()
    await expect.poll(() => mainWindow.evaluate(() => navigator.clipboard.readText())).toBe('Wrapped Body')
    expect(await readRecord(electronApp, 'prompt', 'archive-task')).toMatchObject({ templates: [{ id: TEMPLATE_ID }] })
    await editor.getByTestId('prompt-template-button').click()
    await dialog.getByTestId('prompt-tree-template-prompt-archive-predecessor').click()
    await dialog.getByTestId('prompt-template-confirm-button').click()
    await editor.getByTestId('prompt-copy-button').click()
    await expect.poll(() => mainWindow.evaluate(() => navigator.clipboard.readText())).toBe('Other Body')
    await editor.getByTestId('prompt-template-button').click()
    await dialog.getByTestId('prompt-template-option-none').click()
    await dialog.getByTestId('prompt-template-confirm-button').click()
    await editor.getByTestId('prompt-copy-button').click()
    await expect.poll(() => mainWindow.evaluate(() => navigator.clipboard.readText())).toBe('Body')
    await mainWindow.locator(promptEditorSelector('archive-quick-task')).getByTestId('prompt-template-and-copy-button').click()
    /** Quick selection shares the Active-only library restriction. */
    const quickDialog = mainWindow.getByRole('dialog', { name: 'Quick Template Selection' })
    await expect(quickDialog.getByTestId(`prompt-tree-template-prompt-${TEMPLATE_ID}`)).toHaveCount(0)
    await quickDialog.getByTestId('prompt-tree-template-prompt-archive-predecessor').click()
    await expect.poll(() => mainWindow.evaluate(() => navigator.clipboard.readText())).toBe('Other Quick body')
  })

  test('restores to Uncategorized after category deletion and immediately deletes blank templates', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(createArchiveWorkspace())
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(WORKSPACE_PATH))
    /** Category deletion is performed through the same UI used for active templates. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Library')
    await mainWindow.locator(promptEditorSelector(TEMPLATE_ID)).getByTestId('prompt-archive-button').click()
    await expect.poll(() => readRecord(electronApp, 'promptTemplate', TEMPLATE_ID).then((item) => item?.status === 'Archived')).toBe(true)
    await openManageCategoriesFromSidebar(mainWindow)
    /** Removing the former category forces restoration into Uncategorized. */
    const dialog = mainWindow.getByRole('dialog', { name: 'Manage Categories' })
    await dialog.getByTestId('manage-category-selector-archive-category').click()
    await dialog.getByTestId('manage-categories-delete-button').click()
    await dialog.getByTestId('manage-categories-save-button').click()
    await expect(dialog).not.toBeVisible()
    await mainWindow.getByTestId('prompt-collection-archived-filter').click()
    await mainWindow.locator(promptEditorSelector(TEMPLATE_ID)).getByTestId('template-restore-button').click()
    await expect.poll(async () => (await readOrder(electronApp, 'archive-library')).categories[0].entries.map((entry: { id: string }) => entry.id)).toEqual([TEMPLATE_ID, 'archive-predecessor'])
    expect(await readRecord(electronApp, 'promptTemplate', TEMPLATE_ID)).not.toHaveProperty('category')
    await mainWindow.getByTestId('prompt-collection-active-filter').click()
    await mainWindow.getByTestId('prompt-divider-add-initial').click()
    await expect.poll(() => getPromptEditorIds(mainWindow)).toHaveLength(3)
    /** Newly created blank template uses immediate Delete with Archive in its dropdown. */
    const blankId = (await getPromptEditorIds(mainWindow)).find((id) => id !== TEMPLATE_ID && id !== 'archive-predecessor')!
    /** Blank editor is removed without opening a confirmation dialog. */
    const blankEditor = mainWindow.locator(promptEditorSelector(blankId))
    await blankEditor.getByTestId('prompt-delete-more-options-button').click()
    await expect(mainWindow.getByTestId('prompt-archive-menu-item')).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await blankEditor.getByTestId('prompt-delete-button').click()
    await expect(blankEditor).toHaveCount(0)
    await expect(mainWindow.getByRole('dialog', { name: 'Delete Template' })).toHaveCount(0)
  })
})
