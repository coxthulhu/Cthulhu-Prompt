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

// The sample workspace lets the tests exercise V1 and V2 roots together.
const WORKSPACE_PATH = '/ws/sample'
// These selectors target the shared folder-creation controls.
const FOLDER_ADD_ITEM = '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'
const FOLDER_TYPE_SELECTOR = '[data-testid="create-prompt-folder-type-selector"]'
const FOLDER_TYPE_MENU = '[data-testid="create-prompt-folder-type-menu"]'
const FOLDER_NAME_INPUT = '[data-testid="create-prompt-folder-name-input"]'
const FOLDER_CREATE_BUTTON = '[data-testid="create-prompt-folder-button"]'
// These selectors target V2 prompt and status controls.
const ADD_PROMPT_BUTTON = '[data-testid="sidebar-add-prompt-button"]'
const TOGGLE_COMPLETED_BUTTON = '[data-testid="toggle-completed-prompts-button"]'
const TOGGLE_ALL_FOLDERS_BUTTON = '[data-testid="toggle-all-prompt-folders-button"]'
// These stable names make the persisted V2 paths explicit in the assertions.
const ALPHA_NAME = 'V2 Alpha'
const BETA_NAME = 'V2 Beta'
const FIRST_PROMPT_TITLE = 'Alpha First'
const SECOND_PROMPT_TITLE = 'Alpha Second'

// Returns the root disk path for one V2 prompt folder.
const v2FolderPath = (folderName: string): string =>
  `${WORKSPACE_PATH}/Prompts/${folderName.replace(/\s+/g, '')}`

// Returns the only persisted ordering file used by a V2 prompt folder.
const v2ActiveOrderPath = (folderName: string): string =>
  `${v2FolderPath(folderName)}/Active/_FolderInfo/FolderOrder.json`

// Creates and selects a V2 root through the production creation dialog.
const createV2Folder = async (page: Page, folderName: string): Promise<void> => {
  await page.locator(promptFolderSelectorTriggerSelector).click()
  await page.locator(FOLDER_ADD_ITEM).click()
  await page.locator(FOLDER_TYPE_SELECTOR).click()
  await page.locator(FOLDER_TYPE_MENU).getByText('Prompt Folder V2', { exact: true }).click()
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
      promptIds = await readPromptFolderEntryIds(electronApp, v2ActiveOrderPath(folderName))
      return promptIds.length
    })
    .toBe(count)
  return promptIds
}

describe('Prompt Folder V2', () => {
  test('creates the V2 disk layout and disables subfolder controls', async ({
    electronApp,
    testSetup
  }) => {
    // The sample workspace starts on an existing V1 root with a visible selector.
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })

    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    await mainWindow.locator(FOLDER_ADD_ITEM).click()
    await expect(mainWindow.locator(FOLDER_TYPE_SELECTOR)).toHaveText('Prompt Folder V1')
    await mainWindow.locator(FOLDER_TYPE_SELECTOR).click()
    // The creation menu exposes exactly the two prompt versions and template folders.
    const typeMenu = mainWindow.locator(FOLDER_TYPE_MENU)
    await expect(typeMenu.locator('[role="menuitem"]')).toHaveCount(3)
    await expect(typeMenu.getByText('Prompt Folder V1', { exact: true })).toBeVisible()
    await expect(typeMenu.getByText('Prompt Folder V2', { exact: true })).toBeVisible()
    await expect(typeMenu.getByText('Prompt Template Folder', { exact: true })).toBeVisible()
    await typeMenu.getByText('Prompt Folder V2', { exact: true }).click()
    await expect(
      mainWindow.locator('[role="dialog"][aria-label="Create Prompt Folder V2"]')
    ).toBeVisible()
    await expect(mainWindow.getByLabel('Prompt Folder V2 Name')).toBeVisible()
    await mainWindow.locator(FOLDER_NAME_INPUT).fill(ALPHA_NAME)
    await mainWindow.locator(FOLDER_CREATE_BUTTON).click()

    // The selected V2 root uses the dedicated numeral icon in the sidebar trigger.
    const selectorTrigger = mainWindow.locator(promptFolderSelectorTriggerSelector)
    await expect(selectorTrigger).toContainText(ALPHA_NAME)
    await expect(selectorTrigger.locator('[data-testid="prompt-folder-v2-icon"]')).toHaveText('2')
    await expect(mainWindow.locator(TOGGLE_ALL_FOLDERS_BUTTON)).toBeDisabled()
    await expect(
      mainWindow.locator('[data-testid^="prompt-divider-add-subfolder-"]')
    ).toHaveCount(0)

    // The root metadata identifies V2 while only Active owns an order file.
    const alphaPath = v2FolderPath(ALPHA_NAME)
    await expect
      .poll(() => checkFileExists(electronApp, `${alphaPath}/_FolderInfo/FolderInfo.json`))
      .toBe(true)
    expect(JSON.parse(await readTextFile(electronApp, `${alphaPath}/_FolderInfo/FolderInfo.json`)))
      .toMatchObject({ displayName: ALPHA_NAME, kind: 'prompt-v2' })
    // Root V1, V2, and template folders share the authoritative workspace ordering file.
    const alphaId = await readFolderId(electronApp, alphaPath)
    const workspaceOrder = JSON.parse(
      await readTextFile(electronApp, `${WORKSPACE_PATH}/WorkspaceFolderOrder.json`)
    ) as { entries: Array<{ kind: 'folder'; id: string }> }
    expect(workspaceOrder.entries).toContainEqual({ kind: 'folder', id: alphaId })
    await expect(
      readPromptFolderEntryIds(electronApp, v2ActiveOrderPath(ALPHA_NAME))
    ).resolves.toEqual([])
    await expect(checkFileExists(electronApp, `${alphaPath}/Completed/_FolderInfo`)).resolves.toBe(
      true
    )

    // V2 omits root ordering and all status metadata not explicitly required.
    const omittedPaths = [
      `${alphaPath}/_FolderInfo/FolderOrder.json`,
      `${alphaPath}/_FolderInfo/PromptPrefix.md`,
      `${alphaPath}/_FolderInfo/PromptSuffix.md`,
      `${alphaPath}/Active/_FolderInfo/FolderInfo.json`,
      `${alphaPath}/Active/_FolderInfo/Description.md`,
      `${alphaPath}/Completed/_FolderInfo/FolderInfo.json`,
      `${alphaPath}/Completed/_FolderInfo/Description.md`,
      `${alphaPath}/Completed/_FolderInfo/FolderOrder.json`
    ]
    await expect(
      Promise.all(omittedPaths.map((path) => checkFileExists(electronApp, path)))
    ).resolves.toEqual(omittedPaths.map(() => false))
  })

  test('orders active prompts, moves only within V2, and switches completed storage', async ({
    electronApp,
    testSetup
  }) => {
    // Two V2 roots provide a legal destination alongside the sample V1 roots.
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await createV2Folder(mainWindow, ALPHA_NAME)
    await createV2Folder(mainWindow, BETA_NAME)

    // Folder IDs identify legal and illegal selector drop targets.
    const alphaPath = v2FolderPath(ALPHA_NAME)
    const betaPath = v2FolderPath(BETA_NAME)
    const alphaId = await readFolderId(electronApp, alphaPath)
    const betaId = await readFolderId(electronApp, betaPath)
    const developmentId = await readFolderId(
      electronApp,
      `${WORKSPACE_PATH}/Prompts/Development`
    )
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
      .poll(() => readPromptFolderEntryIds(electronApp, v2ActiveOrderPath(ALPHA_NAME)))
      .toEqual(reversedPromptIds)
    await mainWindow
      .locator(`${promptEditorSelector(initialTopPromptId)} [data-testid="prompt-move-up"]`)
      .click()
    await expect
      .poll(() => readPromptFolderEntryIds(electronApp, v2ActiveOrderPath(ALPHA_NAME)))
      .toEqual(initialPromptIds)

    // A V2 prompt cannot be dropped on a V1 destination.
    await beginPromptHandleDrag(mainWindow, firstPromptId)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
    const v1Destination = mainWindow.locator(
      promptFolderSelectorDropdownItemSelector(developmentId)
    )
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(developmentId)
    )
    await expect(v1Destination).not.toHaveAttribute('data-row-state', 'over')
    await finishActiveDrag(mainWindow)
    await expect(
      readPromptFolderEntryIds(electronApp, v2ActiveOrderPath(ALPHA_NAME))
    ).resolves.toEqual(initialPromptIds)

    // The same active prompt can move to another V2 root.
    await beginPromptHandleDrag(mainWindow, firstPromptId)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
    const v2Destination = mainWindow.locator(promptFolderSelectorDropdownItemSelector(betaId))
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorDropdownItemSelector(betaId))
    await expect(v2Destination).toHaveAttribute('data-row-state', 'over')
    await finishActiveDrag(mainWindow)
    await expect
      .poll(() => readPromptFolderEntryIds(electronApp, v2ActiveOrderPath(ALPHA_NAME)))
      .toEqual([secondPromptId])
    await expect
      .poll(() => readPromptFolderEntryIds(electronApp, v2ActiveOrderPath(BETA_NAME)))
      .toEqual([firstPromptId])

    // The reverse V1-to-V2 drag is also rejected.
    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    await mainWindow.locator(promptFolderSelectorDropdownItemSelector(developmentId)).click()
    await beginPromptHandleDrag(mainWindow, 'dev-1')
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
    const reverseV2Destination = mainWindow.locator(
      promptFolderSelectorDropdownItemSelector(betaId)
    )
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorDropdownItemSelector(betaId))
    await expect(reverseV2Destination).not.toHaveAttribute('data-row-state', 'over')
    await finishActiveDrag(mainWindow)
    await expect(
      readPromptFolderEntryIds(
        electronApp,
        `${WORKSPACE_PATH}/Prompts/Development/_FolderInfo/FolderOrder.json`
      )
    ).resolves.toEqual(['dev-1', 'dev-2'])
    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    await mainWindow.locator(promptFolderSelectorDropdownItemSelector(betaId)).click()

    // Completing moves the Markdown file from Active to Completed and updates frontmatter.
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
      readPromptFolderEntryIds(electronApp, v2ActiveOrderPath(BETA_NAME))
    ).resolves.toEqual([])

    // Completed mode shows the prompt without any movement affordance.
    await mainWindow.locator(TOGGLE_COMPLETED_BUTTON).click()
    await expect(mainWindow.locator(promptEditorSelector(firstPromptId))).toBeVisible()
    await expect(
      mainWindow.locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-drag-handle"]`)
    ).toHaveCount(0)
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

    // Switching back to Active reveals the restored prompt in the V2 root.
    await mainWindow.locator(TOGGLE_COMPLETED_BUTTON).click()
    await expect(mainWindow.locator(promptEditorSelector(firstPromptId))).toBeVisible()
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')
  })
})
