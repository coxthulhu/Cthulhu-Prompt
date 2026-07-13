import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const DAY_MS = 24 * 60 * 60 * 1000
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM = '[data-testid^="sidebar-prompt-folder-dropdown-item-"]'
const SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME =
  '[data-testid="sidebar-prompt-folder-modified-time"]'
const NESTED_PROMPT_EDITOR = promptEditorSelector('subfolders-ui-nested-prompt')
const NESTED_PROMPT_TITLE = `${NESTED_PROMPT_EDITOR} ${PROMPT_TITLE_SELECTOR}`

const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()

describe('Prompt folder selector metadata', () => {
  test('aggregates active descendant prompts and refreshes the newest modified time', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: {
        scenario: 'subfolders-ui',
        fileModifiedTimes: {
          '/ws/subfolders-ui/Prompts/Hierarchy/Root Before.prompt.md': daysAgo(5),
          '/ws/subfolders-ui/Prompts/Hierarchy/Root After.prompt.md': daysAgo(4),
          '/ws/subfolders-ui/Prompts/Hierarchy/Nested/Nested Prompt.prompt.md': daysAgo(3),
          '/ws/subfolders-ui/Prompts/Hierarchy/Nested/Grandchild/Grandchild Prompt.prompt.md':
            daysAgo(2),
          '/ws/subfolders-ui/Prompts/Hierarchy/_Completed/Root Completed.prompt.md': daysAgo(0)
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
    await waitForMonacoEditor(mainWindow, NESTED_PROMPT_EDITOR)
    await mainWindow.locator(NESTED_PROMPT_TITLE).fill('Nested Prompt Updated')

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await expect(hierarchyItem.locator(SIDEBAR_PROMPT_FOLDER_MODIFIED_TIME)).toHaveText('Today')
    await testHelpers.resumeIpcChannel('update-prompt')
  })
})
