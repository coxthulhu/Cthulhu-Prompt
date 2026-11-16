import { showCollectionBrowser } from '../helpers/PromptCollectionHelpers'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptCollectionSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const DAY_MS = 24 * 60 * 60 * 1000
const SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ITEM = '[data-testid^="new-tab-collection-"]'
const CATEGORY_PROMPT_EDITOR = promptEditorSelector('categories-ui-category-prompt')
const CATEGORY_PROMPT_TITLE = `${CATEGORY_PROMPT_EDITOR} ${PROMPT_TITLE_SELECTOR}`

const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()

describe('Prompt collection selector metadata', () => {
  test('aggregates active descendant prompts and refreshes the newest modified time', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: {
        scenario: 'categories-ui',
        fileModifiedTimes: {
          '/ws/categories-ui/DefaultProject/Prompts/Hierarchy/Active/Root Before.prompt.md': daysAgo(5),
          '/ws/categories-ui/DefaultProject/Prompts/Hierarchy/Active/Root After.prompt.md': daysAgo(4),
          '/ws/categories-ui/DefaultProject/Prompts/Hierarchy/Active/Category Prompt.prompt.md': daysAgo(3),
          '/ws/categories-ui/DefaultProject/Prompts/Hierarchy/Active/Second Category Prompt.prompt.md':
            daysAgo(2),
          '/ws/categories-ui/DefaultProject/Prompts/Hierarchy/Completed/Root Completed.prompt.md': daysAgo(0)
        }
      }
    })

    await showCollectionBrowser(mainWindow)

    const hierarchyItem = mainWindow
      .locator(SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ITEM)
      .filter({ hasText: 'Hierarchy' })
    const emptyRootItem = mainWindow
      .locator(SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ITEM)
      .filter({ hasText: 'Empty Root' })

    await expect(hierarchyItem).toContainText('4 prompts')
    await expect(hierarchyItem).toContainText(
      '2 days ago'
    )
    await expect(emptyRootItem).toContainText('0 prompts')
    await expect(emptyRootItem).not.toContainText('ago')
    await hierarchyItem.click()

    await testHelpers.pauseIpcChannel('update-prompt')
    await testHelpers.navigateToPromptCollections('Hierarchy')
    await waitForMonacoEditor(mainWindow, CATEGORY_PROMPT_EDITOR)
    await mainWindow.locator(CATEGORY_PROMPT_TITLE).fill('Category Prompt Updated')

    await showCollectionBrowser(mainWindow)
    await expect(hierarchyItem).toContainText('Today')
    await testHelpers.resumeIpcChannel('update-prompt')
  })
})
