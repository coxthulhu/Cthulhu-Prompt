import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const FIND_INPUT = '[data-testid="prompt-find-input"]'
const FIND_PREV = '[data-testid="prompt-find-prev"]'
const FIND_NEXT = '[data-testid="prompt-find-next"]'
const FIND_CLOSE = '[data-testid="prompt-find-close"]'

const longQuery = 'nonmatching-0123456789-abcdefghijklmnopqrstuvwxyz-unique-query'

const getSelectionInfo = async (page: any) => {
  return await page.locator(FIND_INPUT).evaluate((el: HTMLTextAreaElement) => {
    return {
      start: el.selectionStart,
      end: el.selectionEnd,
      value: el.value
    }
  })
}

describe('Prompt folder find dialog', () => {
  test('reopens with previous query and selection', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    // Open a prompt folder so the find dialog is available.
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findPrev = mainWindow.locator(FIND_PREV)
    const findNext = mainWindow.locator(FIND_NEXT)
    const findClose = mainWindow.locator(FIND_CLOSE)

    // Step 1-3: open find, confirm dialog and disabled buttons.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findPrev).toHaveAttribute('aria-disabled', 'true')
    await expect(findNext).toHaveAttribute('aria-disabled', 'true')

    // Step 4-5: type a long query, then close.
    await findInput.fill(longQuery)
    await findClose.click()
    await expect(findInput).toHaveCount(0)

    // Step 6: reopen, confirm focus + preserved text + full selection.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(longQuery)
    await expect(findInput).toBeFocused()

    await expect
      .poll(async () => getSelectionInfo(mainWindow), { timeout: 2000 })
      .toEqual({ start: 0, end: longQuery.length, value: longQuery })
  })
})
