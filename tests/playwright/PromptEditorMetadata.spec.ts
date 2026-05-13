import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  PROMPT_LINE_COUNT_SELECTOR,
  PROMPT_MODIFIED_TIME_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  PROMPT_TOKEN_COUNT_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const EMPTY_PROMPT_EDITOR = promptEditorSelector('empty-1')
const SIMPLE_PROMPT_EDITOR = promptEditorSelector('simple-1')
const DEVELOPMENT_PROMPT_EDITOR = promptEditorSelector('dev-1')
const promptLineCountSelector = `${EMPTY_PROMPT_EDITOR} ${PROMPT_LINE_COUNT_SELECTOR}`
const promptTokenCountSelector = `${EMPTY_PROMPT_EDITOR} ${PROMPT_TOKEN_COUNT_SELECTOR}`
const promptModifiedTimeSelector = `${EMPTY_PROMPT_EDITOR} ${PROMPT_MODIFIED_TIME_SELECTOR}`
const simplePromptTitleSelector = `${SIMPLE_PROMPT_EDITOR} ${PROMPT_TITLE_SELECTOR}`
const simplePromptModifiedTimeSelector = `${SIMPLE_PROMPT_EDITOR} ${PROMPT_MODIFIED_TIME_SELECTOR}`
const developmentPromptModifiedTimeSelector = `${DEVELOPMENT_PROMPT_EDITOR} ${PROMPT_MODIFIED_TIME_SELECTOR}`
const OLD_PROMPT_MODIFIED_AT = '2023-01-01T00:00:00.000Z'

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

  test('refreshes the modified time immediately after title and body edits', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: {
        scenario: 'sample',
        fileModifiedTimes: {
          '/ws/sample/Prompts/Examples/Simple Greeting-simple-1.md': OLD_PROMPT_MODIFIED_AT,
          '/ws/sample/Prompts/Development/Code Review-dev-1.md': OLD_PROMPT_MODIFIED_AT
        }
      }
    })
    await testHelpers.pauseIpcChannel('update-prompt')

    await testHelpers.navigateToPromptFolders('Examples')

    const simpleModifiedTime = mainWindow.locator(simplePromptModifiedTimeSelector)
    await expect(simpleModifiedTime).not.toHaveText('Updated today')

    await mainWindow.locator(simplePromptTitleSelector).fill('Simple Greeting Updated')
    await expect(simpleModifiedTime).toHaveText('Updated today')

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, DEVELOPMENT_PROMPT_EDITOR)

    const developmentModifiedTime = mainWindow.locator(developmentPromptModifiedTimeSelector)
    await expect(developmentModifiedTime).not.toHaveText('Updated today')

    await focusMonacoEditor(mainWindow, DEVELOPMENT_PROMPT_EDITOR)
    await mainWindow.keyboard.type(' updated', { delay: 20 })

    await expect(developmentModifiedTime).toHaveText('Updated today')
    await testHelpers.resumeIpcChannel('update-prompt')
  })
})
