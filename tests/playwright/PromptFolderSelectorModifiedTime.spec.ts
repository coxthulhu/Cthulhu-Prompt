import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const DAY_MS = 24 * 60 * 60 * 1000
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM = '[data-testid^="sidebar-prompt-folder-dropdown-item-"]'
const SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME = '[data-testid="sidebar-prompt-folder-modified-time"]'
const CATEGORY_PROMPT_EDITOR = promptEditorSelector('categories-ui-category-prompt')
const CATEGORY_PROMPT_TITLE = `${CATEGORY_PROMPT_EDITOR} ${PROMPT_TITLE_SELECTOR}`

const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()

describe('Prompt folder selector metadata', () => {
  test('aggregates active descendant prompts and refreshes the newest modified time', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: {
        scenario: 'categories-ui',
        fileModifiedTimes: {
          '/ws/categories-ui/Prompts/Hierarchy/Active/Root Before.prompt.md': daysAgo(5),
          '/ws/categories-ui/Prompts/Hierarchy/Active/Root After.prompt.md': daysAgo(4),
          '/ws/categories-ui/Prompts/Hierarchy/Active/Category Prompt.prompt.md': daysAgo(3),
          '/ws/categories-ui/Prompts/Hierarchy/Active/Second Category Prompt.prompt.md':
            daysAgo(2),
          '/ws/categories-ui/Prompts/Hierarchy/Completed/Root Completed.prompt.md': daysAgo(0)
        }
      }
    })

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()

    const hierarchyItem = mainWindow
      .locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM)
      .filter({ hasText: 'Hierarchy' })
    const emptyRootItem = mainWindow
      .locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM)
      .filter({ hasText: 'Empty Root' })

    await expect(hierarchyItem).toContainText('4 prompts')
    await expect(hierarchyItem.locator(SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME)).toHaveText(
      '2 days ago'
    )
    await expect(emptyRootItem).toContainText('0 prompts')
    await expect(emptyRootItem.locator(SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME)).toHaveCount(0)
    await mainWindow.keyboard.press('Escape')

    await testHelpers.pauseIpcChannel('update-prompt')
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await waitForMonacoEditor(mainWindow, CATEGORY_PROMPT_EDITOR)
    await mainWindow.locator(CATEGORY_PROMPT_TITLE).fill('Category Prompt Updated')

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await expect(hierarchyItem.locator(SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME)).toHaveText('Today')
    await testHelpers.resumeIpcChannel('update-prompt')
  })
})
