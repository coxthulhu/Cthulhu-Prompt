import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const FIND_INPUT = '[data-testid="prompt-find-input"]'
const FIND_CLOSE = '[data-testid="prompt-find-close"]'

describe('Prompt folder find dialog', () => {
  test('opens with Ctrl+F and closes with Escape or the close button', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    // Open a prompt folder so the find dialog is available.
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findClose = mainWindow.locator(FIND_CLOSE)

    // Step 1: open find.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    // Step 2: close with Escape.
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    // Step 3: reopen, then close with the X button.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findClose.click()
    await expect(findInput).toHaveCount(0)
  })

  test.skip('reopens with previous query and selection', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

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

    // Open a prompt folder so the find dialog is available.
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findPrev = mainWindow.locator('[data-testid="prompt-find-prev"]')
    const findNext = mainWindow.locator('[data-testid="prompt-find-next"]')
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
