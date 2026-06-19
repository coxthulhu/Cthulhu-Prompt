import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const DAY_MS = 24 * 60 * 60 * 1000
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM = '[data-testid^="sidebar-prompt-folder-dropdown-item-"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM =
  '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'
const SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME =
  '[data-testid="sidebar-prompt-folder-modified-time"]'
const SIMPLE_PROMPT_EDITOR = promptEditorSelector('simple-1')
const SIMPLE_PROMPT_TITLE = `${SIMPLE_PROMPT_EDITOR} ${PROMPT_TITLE_SELECTOR}`

const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()

describe('Prompt folder selector modified time', () => {
  test('shows prompt-derived folder times and refreshes them after prompt changes', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: {
        scenario: 'sample',
        fileModifiedTimes: {
          '/ws/sample/Prompts/Examples/Simple Greeting-simple-1.prompt.md': daysAgo(2),
          '/ws/sample/Prompts/Development/Code Review-dev-1.prompt.md': daysAgo(4),
          '/ws/sample/Prompts/Development/Bug Analysis-dev-2.prompt.md': daysAgo(1)
        }
      }
    })

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()

    const examplesItem = mainWindow
      .locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM)
      .filter({ hasText: 'Example Prompts' })
    const developmentItem = mainWindow
      .locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM)
      .filter({ hasText: 'Development Tools' })

    await expect(examplesItem).toContainText('1 prompt')
    await expect(examplesItem.locator(SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME)).toHaveText(
      '2 days ago'
    )
    await expect(examplesItem.locator(`${SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME} svg`)).toHaveCount(1)
    await expect(developmentItem.locator(SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME)).toHaveText(
      'Yesterday'
    )

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM).click()
    await mainWindow.locator('[data-testid="create-prompt-folder-name-input"]').fill('Empty Time')
    await mainWindow.locator('[data-testid="create-prompt-folder-button"]').click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Empty Time'
    )

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    const emptyItem = mainWindow
      .locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM)
      .filter({ hasText: 'Empty Time' })
    await expect(emptyItem).toContainText('0 prompts')
    await expect(emptyItem.locator(SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME)).toHaveCount(0)
    await mainWindow.keyboard.press('Escape')

    await testHelpers.pauseIpcChannel('update-prompt')
    await testHelpers.navigateToPromptFolders('Examples')
    await waitForMonacoEditor(mainWindow, SIMPLE_PROMPT_EDITOR)
    await mainWindow.locator(SIMPLE_PROMPT_TITLE).fill('Simple Greeting Updated')

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await expect(examplesItem.locator(SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME)).toHaveText('Today')
    await testHelpers.resumeIpcChannel('update-prompt')
  })
})
