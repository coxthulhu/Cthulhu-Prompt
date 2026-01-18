import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { PROMPT_FOLDER_HOST_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import {
  VIRTUAL_FIND_FIRST_PROMPT_ID,
  VIRTUAL_FIND_LAST_PROMPT_ID,
  VIRTUAL_FIND_MARKER
} from '../helpers/VirtualFindTestConstants'

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

  test('reopens with previous query and selection', async ({ testSetup }) => {
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

  test('scrolls to a virtualized match and highlights it immediately', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Long')
    await mainWindow.waitForSelector(promptEditorSelector('virtualization-test-1'), {
      state: 'attached'
    })

    const targetSelector = promptEditorSelector(VIRTUAL_FIND_LAST_PROMPT_ID)
    await expect(mainWindow.locator(targetSelector)).toHaveCount(0)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    const uniqueQuery = VIRTUAL_FIND_MARKER
    await findInput.fill(uniqueQuery)
    await expect(mainWindow.locator('[data-testid="prompt-find-widget"]')).not.toContainText(
      'No results'
    )

    await findInput.press('Enter')

    const firstSelector = promptEditorSelector(VIRTUAL_FIND_FIRST_PROMPT_ID)
    await expect
      .poll(async () => {
        return await mainWindow.evaluate(
          ({ selector, expected }) => {
            const monacoNode = document.querySelector(`${selector} .monaco-editor`)
            if (!monacoNode) return null

            const registry = (
              window as unknown as {
                __cthulhuMonacoEditors?: Array<{
                  container: HTMLElement | null
                  editor: {
                    getSelection: () => any
                    getModel: () => {
                      getValueInRange: (range: any) => string
                    } | null
                  }
                }>
              }
            ).__cthulhuMonacoEditors

            if (!registry?.length) return null

            const entry = registry.find((item) => {
              if (!item?.container) return false
              return item.container === monacoNode || item.container.contains(monacoNode)
            })

            if (!entry) return null
            const model = entry.editor.getModel()
            const selection = entry.editor.getSelection()
            if (!model || !selection) return null
            const text = model.getValueInRange(selection)
            return text === expected
          },
          { selector: firstSelector, expected: uniqueQuery }
        )
      })
      .toBe(true)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate((selector) => {
          return document.querySelector(selector) != null
        }, `${firstSelector} .monaco-editor .currentFindMatch`)
      })
      .toBe(true)

    await expect(mainWindow.locator(targetSelector)).toHaveCount(0)

    await findInput.press('Enter')
    await mainWindow.waitForSelector(targetSelector, { state: 'attached' })

    const scrollTop = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
    expect(scrollTop).toBeGreaterThan(0)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate(
          ({ selector, expected }) => {
            const monacoNode = document.querySelector(`${selector} .monaco-editor`)
            if (!monacoNode) return null

            const registry = (
              window as unknown as {
                __cthulhuMonacoEditors?: Array<{
                  container: HTMLElement | null
                  editor: {
                    getSelection: () => any
                    getModel: () => {
                      getValueInRange: (range: any) => string
                    } | null
                  }
                }>
              }
            ).__cthulhuMonacoEditors

            if (!registry?.length) return null

            const entry = registry.find((item) => {
              if (!item?.container) return false
              return item.container === monacoNode || item.container.contains(monacoNode)
            })

            if (!entry) return null
            const model = entry.editor.getModel()
            const selection = entry.editor.getSelection()
            if (!model || !selection) return null
            const text = model.getValueInRange(selection)
            return text === expected
          },
          { selector: targetSelector, expected: uniqueQuery }
        )
      })
      .toBe(true)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate((selector) => {
          return document.querySelector(selector) != null
        }, `${targetSelector} .monaco-editor .currentFindMatch`)
      })
      .toBe(true)
  })
})
