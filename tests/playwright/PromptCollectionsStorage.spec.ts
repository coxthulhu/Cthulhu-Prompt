import { readWorkspaceCollectionOrder } from '../helpers/UserPersistenceHelpers'
import type { Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  selectedQuickCollectionSelector,
  promptEditorSelector,
  promptCollectionSelectorDropdownItemSelector,
  promptCollectionSelectorMenuSelector,
  promptCollectionSelectorTriggerSelector
} from '../helpers/PromptCollectionSelectors'
import {
  checkFileExists,
  readTextFile,
  readPromptCollectionEntryIds
} from '../helpers/PromptPersistenceTestHelpers'
import {
  beginPromptHandleDrag,
  finishActiveDrag,
  moveActiveDragToTarget
} from '../helpers/PromptDragDropHelpers'

// The repository Playwright wrapper supplies the configured test primitives.
const { test, describe, expect } = createPlaywrightTestSuite()

// The sample workspace supplies existing canonical prompt collections.
const WORKSPACE_PATH = '/ws/sample'
// These selectors target the shared collection-creation controls.
const COLLECTION_ADD_ITEM = '[data-testid="sidebar-prompt-collection-dropdown-add-item"]'
const COLLECTION_NAME_INPUT = '[data-testid="create-prompt-collection-name-input"]'
const COLLECTION_CREATE_BUTTON = '[data-testid="create-prompt-collection-button"]'
// These selectors target prompt and status controls.
const ADD_PROMPT_BUTTON = '[data-testid="prompt-divider-add-initial"]'
const TOGGLE_COMPLETED_BUTTON = '[data-testid="toggle-completed-prompts-button"]'
// These stable names make the persisted canonical paths explicit in the assertions.
const ALPHA_NAME = 'Alpha'
/** Template collection created through the dedicated template activity. */
const TEMPLATE_ALPHA_NAME = 'Template Alpha'
const BETA_NAME = 'Beta'
const FIRST_PROMPT_TITLE = 'Alpha First'
const SECOND_PROMPT_TITLE = 'Alpha Second'

// Returns the collection disk path for one prompt collection.
const folderPath = (folderName: string): string =>
  `${WORKSPACE_PATH}/Prompts/${folderName.replace(/\s+/g, '')}`

// Returns the persisted category ordering file used by a prompt collection collection.
const activeOrderPath = (folderName: string): string =>
  `${folderPath(folderName)}/Active/_CollectionInfo/CategoryOrder.json`

// Returns the persisted category-view ordering file owned by a prompt collection.
const activeCategoryOrderPath = (folderName: string): string =>
  `${folderPath(folderName)}/Active/_CollectionInfo/CategoryOrder.json`

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

// Creates and selects a prompt collection through the production creation dialog.
const createCollection = async (page: Page, folderName: string): Promise<void> => {
  await page.locator(promptCollectionSelectorTriggerSelector).click()
  await page.locator(COLLECTION_ADD_ITEM).click()
  await page.locator(COLLECTION_NAME_INPUT).fill(folderName)
  await page.locator(COLLECTION_CREATE_BUTTON).click()
  await expect(page.locator(selectedQuickCollectionSelector)).toContainText(folderName)
}

// Reads the stable collection ID persisted in CollectionInfo.json.
const readCollectionId = async (electronApp: any, folderPath: string): Promise<string> => {
  // The persisted metadata is the authoritative ID used by selector drag targets.
  const collectionInfo = JSON.parse(
    await readTextFile(electronApp, `${folderPath}/_CollectionInfo/CollectionInfo.json`)
  ) as { collectionId: string }
  return collectionInfo.collectionId
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
      promptIds = await readPromptCollectionEntryIds(electronApp, activeOrderPath(folderName))
      return promptIds.length
    })
    .toBe(count)
  return promptIds
}

describe('Prompt collection storage', () => {
  test('creates the canonical disk layout and enables category controls', async ({
    electronApp,
    testSetup
  }) => {
    // The sample workspace starts on an existing prompt collection with a visible selector.
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })

    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    await mainWindow.locator(COLLECTION_ADD_ITEM).click()
    /** Fixed-kind task creation dialog opened from the task activity. */
    const taskDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Create Prompt Collection"]'
    )
    await expect(taskDialog).toBeVisible()
    await expect(taskDialog).toContainText('Organize one-time prompts for individual tasks.')
    await expect(
      mainWindow.locator('[data-testid="create-prompt-collection-type-selector"]')
    ).toHaveCount(0)
    await expect(mainWindow.getByLabel('Collection Name')).toBeVisible()
    await mainWindow.locator(COLLECTION_NAME_INPUT).fill(ALPHA_NAME)
    await mainWindow.locator(COLLECTION_CREATE_BUTTON).click()

    // The selected prompt collection exposes category creation without add-category dividers.
    const selectedCollection = mainWindow.locator(selectedQuickCollectionSelector)
    await expect(selectedCollection).toContainText(ALPHA_NAME)
    // The created task collection identifies its type in the overview header.
    await expect(
      mainWindow.getByTestId('prompt-collection-subtitle')
    ).toHaveText('Task Prompts')
    await expect(mainWindow.locator('[data-testid="prompt-collection-manage-categories-button"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid^="prompt-divider-add-category-"]')).toHaveCount(0)

    // The collection metadata identifies a prompt collection while only Active owns an order file.
    const alphaPath = folderPath(ALPHA_NAME)
    await expect
      .poll(() => checkFileExists(electronApp, `${alphaPath}/_CollectionInfo/CollectionInfo.json`))
      .toBe(true)
    expect(JSON.parse(await readTextFile(electronApp, `${alphaPath}/_CollectionInfo/CollectionInfo.json`)))
      .toMatchObject({ displayName: ALPHA_NAME, kind: 'prompt' })
    // Task collections persist in their independent user-specific SQLite order.
    const alphaId = await readCollectionId(electronApp, alphaPath)
    const workspaceOrder = (await readWorkspaceCollectionOrder(electronApp, WORKSPACE_PATH))!
    expect(workspaceOrder.entries).toContainEqual({ kind: 'collection', id: alphaId })
    await expect(
      readPromptCollectionEntryIds(electronApp, activeOrderPath(ALPHA_NAME))
    ).resolves.toEqual([])
    await expect(readCategoryOrderPromptIds(electronApp, ALPHA_NAME)).resolves.toEqual([])
    await expect(checkFileExists(electronApp, `${alphaPath}/Completed`)).resolves.toBe(
      true
    )
    await expect(checkFileExists(electronApp, `${alphaPath}/Archived`)).resolves.toBe(true)

    // The canonical layout omits collection ordering and status metadata not explicitly required.
    const omittedPaths = [
      `${alphaPath}/_CollectionInfo/CategoryOrder.json`,
      `${alphaPath}/Active/_CollectionInfo/CollectionInfo.json`,
      `${alphaPath}/Active/_CollectionInfo/Description.md`,
      `${alphaPath}/Completed/_CollectionInfo/CollectionInfo.json`,
      `${alphaPath}/Completed/_CollectionInfo/Description.md`,
      `${alphaPath}/Completed/_CollectionInfo/CategoryOrder.json`,
      `${alphaPath}/Archived/_CollectionInfo/CollectionInfo.json`,
      `${alphaPath}/Archived/_CollectionInfo/Description.md`,
      `${alphaPath}/Archived/_CollectionInfo/CategoryOrder.json`
    ]
    await expect(
      Promise.all(omittedPaths.map((path) => checkFileExists(electronApp, path)))
    ).resolves.toEqual(omittedPaths.map(() => false))

    await mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]').click()
    await mainWindow.locator('[data-testid="sidebar-prompt-collection-add-button"]').click()
    /** Fixed-kind template creation dialog opened from the template activity. */
    const templateDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Create Template Collection"]'
    )
    await expect(templateDialog).toContainText(
      'Organize reusable prompts for repeatable workflows.'
    )
    await expect(
      mainWindow.locator('[data-testid="create-prompt-collection-type-selector"]')
    ).toHaveCount(0)
    await mainWindow.locator(COLLECTION_NAME_INPUT).fill(TEMPLATE_ALPHA_NAME)
    await mainWindow.locator(COLLECTION_CREATE_BUTTON).click()
    /** Canonical template collection created by the fixed-kind dialog. */
    const templateAlphaPath = `${WORKSPACE_PATH}/Templates/TemplateAlpha`
    /** Stable ID expected in the template-owned collection order. */
    const templateAlphaId = await readCollectionId(electronApp, templateAlphaPath)
    expect(
      await readWorkspaceCollectionOrder(electronApp, WORKSPACE_PATH, 'template')
    ).toEqual({ entries: [{ kind: 'collection', id: templateAlphaId }] })
  })

  test('orders and moves active prompts and switches completed storage', async ({
    electronApp,
    testSetup
  }) => {
    // Two prompt collections provide a cross-collection move destination.
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await createCollection(mainWindow, ALPHA_NAME)
    await createCollection(mainWindow, BETA_NAME)

    // Collection IDs identify legal and illegal selector drop targets.
    const alphaPath = folderPath(ALPHA_NAME)
    const betaPath = folderPath(BETA_NAME)
    const alphaId = await readCollectionId(electronApp, alphaPath)
    const betaId = await readCollectionId(electronApp, betaPath)
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    await mainWindow.locator(promptCollectionSelectorDropdownItemSelector(alphaId)).click()

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
      .poll(() => readPromptCollectionEntryIds(electronApp, activeOrderPath(ALPHA_NAME)))
      .toEqual(reversedPromptIds)
    await mainWindow
      .locator(`${promptEditorSelector(initialTopPromptId)} [data-testid="prompt-move-up"]`)
      .click()
    await expect
      .poll(() => readPromptCollectionEntryIds(electronApp, activeOrderPath(ALPHA_NAME)))
      .toEqual(initialPromptIds)

    // The active prompt can move to another prompt collection.
    await beginPromptHandleDrag(mainWindow, firstPromptId)
    await moveActiveDragToTarget(mainWindow, promptCollectionSelectorTriggerSelector)
    await expect(mainWindow.locator(promptCollectionSelectorMenuSelector)).toBeVisible()
    const destination = mainWindow.locator(promptCollectionSelectorDropdownItemSelector(betaId))
    await moveActiveDragToTarget(mainWindow, promptCollectionSelectorDropdownItemSelector(betaId))
    await expect(destination).toHaveAttribute('data-row-state', 'over')
    await finishActiveDrag(mainWindow)
    await expect
      .poll(() => readPromptCollectionEntryIds(electronApp, activeOrderPath(ALPHA_NAME)))
      .toEqual([secondPromptId])
    await expect
      .poll(() => readPromptCollectionEntryIds(electronApp, activeOrderPath(BETA_NAME)))
      .toEqual([firstPromptId])
    await expect
      .poll(() => readCategoryOrderPromptIds(electronApp, ALPHA_NAME))
      .toEqual([secondPromptId])
    await expect
      .poll(() => readCategoryOrderPromptIds(electronApp, BETA_NAME))
      .toEqual([firstPromptId])

    // Completing moves the Markdown file from Active to Completed and updates frontmatter.
    await testHelpers.navigateToPromptCollections(BETA_NAME)
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
      readPromptCollectionEntryIds(electronApp, activeOrderPath(BETA_NAME))
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

    // Switching back to Active reveals the restored prompt in the collection.
    await mainWindow.locator(TOGGLE_COMPLETED_BUTTON).click()
    await expect(mainWindow.locator(promptEditorSelector(firstPromptId))).toBeVisible()
    expect(await testHelpers.getActiveScreen()).toBe('prompt-collection')

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
