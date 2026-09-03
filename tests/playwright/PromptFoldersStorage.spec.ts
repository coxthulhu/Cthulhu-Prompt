import type { Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import {
  beginPromptHandleDrag,
  finishActiveDrag,
  moveActiveDragToTarget,
  promptFolderSelectorDropdownItemSelector,
  promptFolderSelectorMenuSelector,
  promptFolderSelectorTriggerSelector,
  readPromptFolderEntryIds
} from '../helpers/PromptDragDropHelpers'

// The repository Playwright wrapper supplies the configured test primitives.
const { test, describe, expect } = createPlaywrightTestSuite()

// The sample workspace supplies existing canonical prompt roots.
const WORKSPACE_PATH = '/ws/sample'
// These selectors target the shared folder-creation controls.
const FOLDER_ADD_ITEM = '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'
const FOLDER_TYPE_SELECTOR = '[data-testid="create-prompt-folder-type-selector"]'
const FOLDER_TYPE_MENU = '[data-testid="create-prompt-folder-type-menu"]'
const FOLDER_NAME_INPUT = '[data-testid="create-prompt-folder-name-input"]'
const FOLDER_CREATE_BUTTON = '[data-testid="create-prompt-folder-button"]'
// These selectors target prompt and status controls.
const ADD_PROMPT_BUTTON = '[data-testid="prompt-divider-add-initial"]'
const TOGGLE_COMPLETED_BUTTON = '[data-testid="toggle-completed-prompts-button"]'
// These stable names make the persisted canonical paths explicit in the assertions.
const ALPHA_NAME = 'Alpha'
const BETA_NAME = 'Beta'
const FIRST_PROMPT_TITLE = 'Alpha First'
const SECOND_PROMPT_TITLE = 'Alpha Second'

// Returns the root disk path for one prompt folder.
const folderPath = (folderName: string): string =>
  `${WORKSPACE_PATH}/Prompts/${folderName.replace(/\s+/g, '')}`

// Returns the persisted category ordering file used by a prompt folder root.
const activeOrderPath = (folderName: string): string =>
  `${folderPath(folderName)}/Active/_FolderInfo/FolderOrder.json`

// Returns the persisted category-view ordering file owned by a prompt root.
const activeCategoryOrderPath = (folderName: string): string =>
  `${folderPath(folderName)}/Active/_FolderInfo/FolderOrder.json`

// Reads every prompt ID across the persisted category groups in UI order.
const readCategoryOrderPromptIds = async (
  electronApp: any,
  folderName: string
): Promise<string[]> => {
  // Parsed category order whose nested entries are flattened for assertions.
  const categoryOrder = JSON.parse(
    await readTextFile(electronApp, activeCategoryOrderPath(folderName))
  ) as { categories: Array<{ entries: Array<{ id: string }> }> }
  return categoryOrder.categories.flatMap((category) =>
    category.entries.map((entry) => entry.id)
  )
}

// Creates and selects a prompt root through the production creation dialog.
const createFolder = async (page: Page, folderName: string): Promise<void> => {
  await page.locator(promptFolderSelectorTriggerSelector).click()
  await page.locator(FOLDER_ADD_ITEM).click()
  await page.locator(FOLDER_NAME_INPUT).fill(folderName)
  await page.locator(FOLDER_CREATE_BUTTON).click()
  await expect(page.locator(promptFolderSelectorTriggerSelector)).toContainText(folderName)
}

// Reads the stable root folder ID persisted in FolderInfo.json.
const readFolderId = async (electronApp: any, folderPath: string): Promise<string> => {
  // The persisted metadata is the authoritative ID used by selector drag targets.
  const folderInfo = JSON.parse(
    await readTextFile(electronApp, `${folderPath}/_FolderInfo/FolderInfo.json`)
  ) as { folderId: string }
  return folderInfo.folderId
}

// Waits for the active order to reach a size and returns its prompt IDs.
const waitForActivePromptIds = async (
  electronApp: any,
  folderName: string,
  count: number
): Promise<string[]> => {
  // Polling accounts for the asynchronous renderer-to-main persistence boundary.
  let promptIds: string[] = []
  await expect
    .poll(async () => {
      promptIds = await readPromptFolderEntryIds(electronApp, activeOrderPath(folderName))
      return promptIds.length
    })
    .toBe(count)
  return promptIds
}

describe('Prompt folder storage', () => {
  test('creates the canonical disk layout and enables category controls', async ({
    electronApp,
    testSetup
  }) => {
    // The sample workspace starts on an existing prompt root with a visible selector.
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })

    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    await mainWindow.locator(FOLDER_ADD_ITEM).click()
    await expect(mainWindow.locator(FOLDER_TYPE_SELECTOR)).toHaveText('Prompt Folder')
    await mainWindow.locator(FOLDER_TYPE_SELECTOR).click()
    // The creation menu exposes prompt and template folders.
    const typeMenu = mainWindow.locator(FOLDER_TYPE_MENU)
    await expect(typeMenu.locator('[role="menuitem"]')).toHaveCount(2)
    await expect(typeMenu.getByText('Prompt Folder', { exact: true })).toBeVisible()
    await expect(typeMenu.getByText('Prompt Template Folder', { exact: true })).toBeVisible()
    await typeMenu.getByText('Prompt Folder', { exact: true }).click()
    await expect(
      mainWindow.locator('[role="dialog"][aria-label="Create Prompt Folder"]')
    ).toBeVisible()
    await expect(mainWindow.getByLabel('Prompt Folder Name')).toBeVisible()
    await mainWindow.locator(FOLDER_NAME_INPUT).fill(ALPHA_NAME)
    await mainWindow.locator(FOLDER_CREATE_BUTTON).click()

    // The selected prompt root exposes category creation without add-category dividers.
    const selectorTrigger = mainWindow.locator(promptFolderSelectorTriggerSelector)
    await expect(selectorTrigger).toContainText(ALPHA_NAME)
    await expect(mainWindow.locator('[data-testid="prompt-folder-add-category-button"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid^="prompt-divider-add-category-"]')).toHaveCount(0)

    // The root metadata identifies a prompt folder while only Active owns an order file.
    const alphaPath = folderPath(ALPHA_NAME)
    await expect
      .poll(() => checkFileExists(electronApp, `${alphaPath}/_FolderInfo/FolderInfo.json`))
      .toBe(true)
    expect(JSON.parse(await readTextFile(electronApp, `${alphaPath}/_FolderInfo/FolderInfo.json`)))
      .toMatchObject({ displayName: ALPHA_NAME, kind: 'prompt' })
    // Prompt and template roots share the authoritative workspace ordering file.
    const alphaId = await readFolderId(electronApp, alphaPath)
    const workspaceOrder = JSON.parse(
      await readTextFile(electronApp, `${WORKSPACE_PATH}/WorkspaceFolderOrder.json`)
    ) as { entries: Array<{ kind: 'folder'; id: string }> }
    expect(workspaceOrder.entries).toContainEqual({ kind: 'folder', id: alphaId })
    await expect(
      readPromptFolderEntryIds(electronApp, activeOrderPath(ALPHA_NAME))
    ).resolves.toEqual([])
    await expect(readCategoryOrderPromptIds(electronApp, ALPHA_NAME)).resolves.toEqual([])
    await expect(checkFileExists(electronApp, `${alphaPath}/Completed`)).resolves.toBe(
      true
    )
    await expect(checkFileExists(electronApp, `${alphaPath}/Archived`)).resolves.toBe(true)

    // The canonical layout omits root ordering and status metadata not explicitly required.
    const omittedPaths = [
      `${alphaPath}/_FolderInfo/FolderOrder.json`,
      `${alphaPath}/Active/_FolderInfo/FolderInfo.json`,
      `${alphaPath}/Active/_FolderInfo/Description.md`,
      `${alphaPath}/Completed/_FolderInfo/FolderInfo.json`,
      `${alphaPath}/Completed/_FolderInfo/Description.md`,
      `${alphaPath}/Completed/_FolderInfo/FolderOrder.json`,
      `${alphaPath}/Archived/_FolderInfo/FolderInfo.json`,
      `${alphaPath}/Archived/_FolderInfo/Description.md`,
      `${alphaPath}/Archived/_FolderInfo/FolderOrder.json`
    ]
    await expect(
      Promise.all(omittedPaths.map((path) => checkFileExists(electronApp, path)))
    ).resolves.toEqual(omittedPaths.map(() => false))
  })

  test('orders and moves active prompts and switches completed storage', async ({
    electronApp,
    testSetup
  }) => {
    // Two prompt roots provide a cross-folder move destination.
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await createFolder(mainWindow, ALPHA_NAME)
    await createFolder(mainWindow, BETA_NAME)

    // Folder IDs identify legal and illegal selector drop targets.
    const alphaPath = folderPath(ALPHA_NAME)
    const betaPath = folderPath(BETA_NAME)
    const alphaId = await readFolderId(electronApp, alphaPath)
    const betaId = await readFolderId(electronApp, betaPath)
    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    await mainWindow.locator(promptFolderSelectorDropdownItemSelector(alphaId)).click()

    // Two active prompts make both move buttons meaningful.
    await mainWindow.locator(ADD_PROMPT_BUTTON).click()
    const firstPromptId = (await waitForActivePromptIds(electronApp, ALPHA_NAME, 1))[0]
    await mainWindow
      .locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-title"]`)
      .fill(FIRST_PROMPT_TITLE)
    await mainWindow.locator(ADD_PROMPT_BUTTON).click()
    const initialPromptIds = await waitForActivePromptIds(electronApp, ALPHA_NAME, 2)
    const secondPromptId = initialPromptIds.find((promptId) => promptId !== firstPromptId)!
    await mainWindow
      .locator(`${promptEditorSelector(secondPromptId)} [data-testid="prompt-title"]`)
      .fill(SECOND_PROMPT_TITLE)
    await expect
      .poll(() => checkFileExists(electronApp, `${alphaPath}/Active/${SECOND_PROMPT_TITLE}.prompt.md`))
      .toBe(true)

    // Move the current first prompt down and up to verify both ordering controls.
    const initialTopPromptId = initialPromptIds[0]
    const reversedPromptIds = [...initialPromptIds].reverse()
    await mainWindow
      .locator(`${promptEditorSelector(initialTopPromptId)} [data-testid="prompt-move-down"]`)
      .click()
    await expect
      .poll(() => readPromptFolderEntryIds(electronApp, activeOrderPath(ALPHA_NAME)))
      .toEqual(reversedPromptIds)
    await mainWindow
      .locator(`${promptEditorSelector(initialTopPromptId)} [data-testid="prompt-move-up"]`)
      .click()
    await expect
      .poll(() => readPromptFolderEntryIds(electronApp, activeOrderPath(ALPHA_NAME)))
      .toEqual(initialPromptIds)

    // The active prompt can move to another prompt root.
    await beginPromptHandleDrag(mainWindow, firstPromptId)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
    const destination = mainWindow.locator(promptFolderSelectorDropdownItemSelector(betaId))
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorDropdownItemSelector(betaId))
    await expect(destination).toHaveAttribute('data-row-state', 'over')
    await finishActiveDrag(mainWindow)
    await expect
      .poll(() => readPromptFolderEntryIds(electronApp, activeOrderPath(ALPHA_NAME)))
      .toEqual([secondPromptId])
    await expect
      .poll(() => readPromptFolderEntryIds(electronApp, activeOrderPath(BETA_NAME)))
      .toEqual([firstPromptId])
    await expect
      .poll(() => readCategoryOrderPromptIds(electronApp, ALPHA_NAME))
      .toEqual([secondPromptId])
    await expect
      .poll(() => readCategoryOrderPromptIds(electronApp, BETA_NAME))
      .toEqual([firstPromptId])

    // Completing moves the Markdown file from Active to Completed and updates frontmatter.
    await testHelpers.navigateToPromptFolders(BETA_NAME)
    await expect(mainWindow.locator(promptEditorSelector(firstPromptId))).toBeVisible()
    const activePromptPath = `${betaPath}/Active/${FIRST_PROMPT_TITLE}.prompt.md`
    const completedPromptPath = `${betaPath}/Completed/${FIRST_PROMPT_TITLE}.prompt.md`
    await mainWindow
      .locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-complete-button"]`)
      .click()
    await expect.poll(() => checkFileExists(electronApp, activePromptPath)).toBe(false)
    await expect.poll(() => checkFileExists(electronApp, completedPromptPath)).toBe(true)
    await expect.poll(() => readTextFile(electronApp, completedPromptPath)).toContain(
      'status: Completed'
    )
    await expect(
      readPromptFolderEntryIds(electronApp, activeOrderPath(BETA_NAME))
    ).resolves.toEqual([])
    await expect(readCategoryOrderPromptIds(electronApp, BETA_NAME)).resolves.toEqual([])

    // Completed mode shows only the cross-status drag handle without ordering arrows.
    await mainWindow.locator(TOGGLE_COMPLETED_BUTTON).click()
    await expect(mainWindow.locator(promptEditorSelector(firstPromptId))).toBeVisible()
    await expect(
      mainWindow.locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-drag-handle"]`)
    ).toHaveCount(1)
    await expect(
      mainWindow.locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-move-up"]`)
    ).toHaveCount(0)
    await expect(
      mainWindow.locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-move-down"]`)
    ).toHaveCount(0)
    await mainWindow
      .locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-uncomplete-button"]`)
      .click()
    await expect.poll(() => checkFileExists(electronApp, completedPromptPath)).toBe(false)
    await expect.poll(() => checkFileExists(electronApp, activePromptPath)).toBe(true)
    await expect.poll(() => readTextFile(electronApp, activePromptPath)).toContain('status: Todo')
    await expect
      .poll(() => readCategoryOrderPromptIds(electronApp, BETA_NAME))
      .toEqual([firstPromptId])

    // Switching back to Active reveals the restored prompt in the root.
    await mainWindow.locator(TOGGLE_COMPLETED_BUTTON).click()
    await expect(mainWindow.locator(promptEditorSelector(firstPromptId))).toBeVisible()
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')

    // Deleting the restored prompt removes it from both active and category-view ordering.
    await mainWindow
      .locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-delete-more-options-button"]`)
      .click()
    await mainWindow.locator('[data-testid="prompt-delete-menu-item"]').click()
    await mainWindow
      .locator('[role="dialog"][aria-label="Delete Prompt"] button:has-text("Delete")')
      .click()
    await expect
      .poll(() => readCategoryOrderPromptIds(electronApp, BETA_NAME))
      .toEqual([])
  })
})
