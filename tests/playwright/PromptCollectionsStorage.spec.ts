import { findCollection, readRecord } from '../helpers/WorkspaceDatabaseHelpers'
import { clickPromptCollectionItem, showCollectionBrowser, openCollectionCreation } from '../helpers/PromptCollectionHelpers'
import { readWorkspaceCollectionOrder } from '../helpers/UserPersistenceHelpers'
import type { Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  selectedCollectionTitleSelector,
  promptEditorSelector,
  collectionTileSelector,
} from '../helpers/PromptCollectionSelectors'
import {
  readPromptCollectionEntryIds
} from '../helpers/PromptPersistenceTestHelpers'

// The repository Playwright wrapper supplies the configured test primitives.
const { test, describe, expect } = createPlaywrightTestSuite()

// The sample workspace supplies existing canonical prompt collections.
const WORKSPACE_PATH = '/ws/sample'
// These selectors target the shared collection-creation controls.
const COLLECTION_NAME_INPUT = '[data-testid="create-prompt-collection-name-input"]'
const COLLECTION_CREATE_BUTTON = '[data-testid="create-prompt-collection-button"]'
// These selectors target prompt and status controls.
const ADD_PROMPT_BUTTON = '[data-testid="prompt-divider-add-initial"]'
const TOGGLE_COMPLETED_BUTTON = '[data-testid="toggle-completed-prompts-button"]'
// These stable names make the persisted canonical paths explicit in the assertions.
const ALPHA_NAME = 'Alpha'
/** Template collection created through the project's template create action. */
const TEMPLATE_ALPHA_NAME = 'Template Alpha'
const BETA_NAME = 'Beta'
const FIRST_PROMPT_TITLE = 'Alpha First'
const SECOND_PROMPT_TITLE = 'Alpha Second'

// Creates and selects a prompt collection through the production creation dialog.
const createCollection = async (page: Page, folderName: string): Promise<void> => {
  await showCollectionBrowser(page)
  await openCollectionCreation(page)
  await page.locator(COLLECTION_NAME_INPUT).fill(folderName)
  await page.locator(COLLECTION_CREATE_BUTTON).click()
  await clickPromptCollectionItem(page, folderName)
  await expect(page.locator(selectedCollectionTitleSelector)).toContainText(folderName)
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
      promptIds = await readPromptCollectionEntryIds(electronApp, folderName)
      return promptIds.length
    })
    .toBe(count)
  return promptIds
}

describe('Prompt collection storage', () => {
  test('creates a collection in the workspace database and enables category controls', async ({
    electronApp,
    testSetup
  }) => {
    // The project shows the collection selector for the sample workspace.
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })

    await showCollectionBrowser(mainWindow)
    await openCollectionCreation(mainWindow)
    await expect(mainWindow.locator('[role="dialog"][aria-label="Create Collection"]')).toBeVisible()
    await expect(mainWindow.getByLabel('Collection Name')).toBeVisible()
    await mainWindow.locator(COLLECTION_NAME_INPUT).fill(ALPHA_NAME)
    await mainWindow.locator(COLLECTION_CREATE_BUTTON).click()
    await clickPromptCollectionItem(mainWindow, ALPHA_NAME)

    // The selected prompt collection exposes category creation without add-category dividers.
    const selectedCollection = mainWindow.locator(selectedCollectionTitleSelector)
    await expect(selectedCollection).toContainText(ALPHA_NAME)
    // The created task collection identifies its type in the overview header.
    await expect(
      mainWindow.getByTestId('prompt-collection-subtitle')
    ).toHaveText('Task Prompts')
    await expect(mainWindow.locator('[data-testid="prompt-collection-manage-categories-button"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid^="prompt-divider-add-category-"]')).toHaveCount(0)

    // Task collections persist in their independent user-specific SQLite order.
    const alphaId = (await findCollection(electronApp, ALPHA_NAME))!.id
    const workspaceOrder = (await readWorkspaceCollectionOrder(electronApp, WORKSPACE_PATH))!
    expect(workspaceOrder.entries).toContainEqual({ kind: 'collection', id: alphaId })
    await expect(readPromptCollectionEntryIds(electronApp, ALPHA_NAME)).resolves.toEqual([])
    await showCollectionBrowser(mainWindow)
    await openCollectionCreation(mainWindow, 'template')
    await mainWindow.locator(COLLECTION_NAME_INPUT).fill(TEMPLATE_ALPHA_NAME)
    await mainWindow.locator(COLLECTION_CREATE_BUTTON).click()
    await expect.poll(() => findCollection(electronApp, 'TemplateAlpha', 'template')).toMatchObject({ id: expect.any(String) })
    /** The committed collection's stable ID must lead the combined project order. */
    const templateAlphaId = (await findCollection(electronApp, 'TemplateAlpha', 'template'))!.id
    await expect.poll(async () => (await readWorkspaceCollectionOrder(electronApp, WORKSPACE_PATH))!.entries[0])
      .toEqual({ kind: 'collection', id: templateAlphaId })
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
    const alphaId = (await findCollection(electronApp, ALPHA_NAME))!.id
    await showCollectionBrowser(mainWindow)
    await mainWindow.locator(collectionTileSelector(alphaId)).click()

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
      .poll(() => readRecord(electronApp, 'prompt', secondPromptId).then((item) => item?.title === SECOND_PROMPT_TITLE))
      .toBe(true)

    // Move the current first prompt down and up to verify both ordering controls.
    const initialTopPromptId = initialPromptIds[0]
    const reversedPromptIds = [...initialPromptIds].reverse()
    await mainWindow
      .locator(`${promptEditorSelector(initialTopPromptId)} [data-testid="prompt-title"]`)
      .focus()
    await mainWindow.keyboard.press('Control+Shift+ArrowDown')
    await expect
      .poll(() => readPromptCollectionEntryIds(electronApp, ALPHA_NAME))
      .toEqual(reversedPromptIds)
    await mainWindow
      .locator(`${promptEditorSelector(initialTopPromptId)} [data-testid="prompt-title"]`)
      .focus()
    await mainWindow.keyboard.press('Control+Shift+ArrowUp')
    await expect
      .poll(() => readPromptCollectionEntryIds(electronApp, ALPHA_NAME))
      .toEqual(initialPromptIds)

    // Completing updates the prompt status and its collection membership.
    await testHelpers.navigateToPromptCollections(ALPHA_NAME)
    await expect(mainWindow.locator(promptEditorSelector(firstPromptId))).toBeVisible()
    await mainWindow
      .locator(`${promptEditorSelector(firstPromptId)} [data-testid="prompt-complete-button"]`)
      .click()
    await expect.poll(() => readRecord(electronApp, 'prompt', firstPromptId).then((item) => item?.status === 'Todo')).toBe(false)
    await expect.poll(() => readRecord(electronApp, 'prompt', firstPromptId).then((item) => item?.status === 'Completed')).toBe(true)
    await expect.poll(() => readRecord(electronApp, 'prompt', firstPromptId)).toMatchObject({ status: 'Completed' })
    await expect(
      readPromptCollectionEntryIds(electronApp, ALPHA_NAME)
    ).resolves.toEqual([secondPromptId])
    await expect(readPromptCollectionEntryIds(electronApp, ALPHA_NAME)).resolves.toEqual([secondPromptId])

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
    await expect.poll(() => readRecord(electronApp, 'prompt', firstPromptId).then((item) => item?.status === 'Completed')).toBe(false)
    await expect.poll(() => readRecord(electronApp, 'prompt', firstPromptId).then((item) => item?.status === 'Todo')).toBe(true)
    await expect.poll(() => readRecord(electronApp, 'prompt', firstPromptId)).toMatchObject({ status: 'Todo' })
    await expect
      .poll(() => readPromptCollectionEntryIds(electronApp, ALPHA_NAME))
      .toEqual([firstPromptId, secondPromptId])

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
      .poll(() => readPromptCollectionEntryIds(electronApp, ALPHA_NAME))
      .toEqual([secondPromptId])
  })
})
