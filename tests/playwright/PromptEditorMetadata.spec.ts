import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  PROMPT_LINE_COUNT_SELECTOR,
  PROMPT_MODIFIED_TIME_SELECTOR,
  PROMPT_TOKEN_COUNT_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const EMPTY_PROMPT_EDITOR = promptEditorSelector('empty-1')
const promptLineCountSelector = `${EMPTY_PROMPT_EDITOR} ${PROMPT_LINE_COUNT_SELECTOR}`
const promptTokenCountSelector = `${EMPTY_PROMPT_EDITOR} ${PROMPT_TOKEN_COUNT_SELECTOR}`
const promptModifiedTimeSelector = `${EMPTY_PROMPT_EDITOR} ${PROMPT_MODIFIED_TIME_SELECTOR}`

describe('Prompt editor metadata', () => {
  test('updates line and token counts from prompt text edits', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Empty')
    await waitForMonacoEditor(mainWindow, EMPTY_PROMPT_EDITOR)

    await expect(mainWindow.locator(promptLineCountSelector)).toHaveText('0 lines')
    await expect(mainWindow.locator(promptTokenCountSelector)).toHaveText('0 tokens')

    await focusMonacoEditor(mainWindow, EMPTY_PROMPT_EDITOR)
    await mainWindow.keyboard.type('A', { delay: 20 })

    await expect(mainWindow.locator(promptLineCountSelector)).toHaveText('1 line')
    await expect(mainWindow.locator(promptTokenCountSelector)).toHaveText('1 token')

    await mainWindow.keyboard.press('Enter')

    await expect(mainWindow.locator(promptLineCountSelector)).toHaveText('2 lines')
  })

  test('shows the prompt file modified time with a tooltip', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Empty')

    const modifiedTime = mainWindow.locator(promptModifiedTimeSelector)
    await expect(modifiedTime).toHaveText('Updated today')
    await expect(modifiedTime).toHaveAttribute('title', /.+/)
  })
})
