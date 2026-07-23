import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  PROMPT_MODIFIED_TIME_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  PROMPT_TOKEN_COUNT_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const EMPTY_PROMPT_EDITOR = promptEditorSelector('empty-1')
const SIMPLE_PROMPT_EDITOR = promptEditorSelector('simple-1')
const DEVELOPMENT_PROMPT_EDITOR = promptEditorSelector('dev-1')
const promptTokenCountSelector = `${EMPTY_PROMPT_EDITOR} ${PROMPT_TOKEN_COUNT_SELECTOR}`
const promptModifiedTimeSelector = `${EMPTY_PROMPT_EDITOR} ${PROMPT_MODIFIED_TIME_SELECTOR}`
const simplePromptTitleSelector = `${SIMPLE_PROMPT_EDITOR} ${PROMPT_TITLE_SELECTOR}`
const simplePromptModifiedTimeSelector = `${SIMPLE_PROMPT_EDITOR} ${PROMPT_MODIFIED_TIME_SELECTOR}`
const developmentPromptModifiedTimeSelector = `${DEVELOPMENT_PROMPT_EDITOR} ${PROMPT_MODIFIED_TIME_SELECTOR}`
const OLD_PROMPT_MODIFIED_AT = '2023-01-01T00:00:00.000Z'

describe('Prompt editor metadata', () => {
  test('keeps the Template item at its intrinsic width when the window narrows', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Empty')

    const templateItem = mainWindow.locator(
      `${EMPTY_PROMPT_EDITOR} .prompt-editor-metadata-folder`
    )
    await expect(templateItem).toHaveText('Template')
    const initialWindowWidth = await mainWindow.evaluate(() => window.innerWidth)
    const initialWidth = await templateItem.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    await electronApp.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window) throw new Error('Missing main window')
      window.setSize(800, window.getBounds().height)
    })

    await expect
      .poll(async () => await mainWindow.evaluate(() => window.innerWidth))
      .toBeLessThan(initialWindowWidth)

    const narrowedWidth = await templateItem.evaluate(
      (element) => element.getBoundingClientRect().width
    )
    expect(Math.abs(narrowedWidth - initialWidth)).toBeLessThanOrEqual(1)
  })

  test('updates the token count from prompt text edits', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Empty')
    await waitForMonacoEditor(mainWindow, EMPTY_PROMPT_EDITOR)

    await expect(mainWindow.locator(promptTokenCountSelector)).toHaveText('0 tokens')

    await focusMonacoEditor(mainWindow, EMPTY_PROMPT_EDITOR)
    await mainWindow.keyboard.type('A', { delay: 20 })

    await expect(mainWindow.locator(promptTokenCountSelector)).toHaveText('1 token')
  })

  test('shows the prompt file modified time with a tooltip', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Empty')

    const modifiedTime = mainWindow.locator(promptModifiedTimeSelector)
    await expect(modifiedTime).toHaveText('Updated today')
    await expect(modifiedTime).toHaveAttribute('title', /.+/)
    await expect(
      mainWindow.locator(`${EMPTY_PROMPT_EDITOR} .prompt-editor-metadata-row`)
    ).toHaveText(/Template.*Updated today.*0 tokens/)
  })

  test('refreshes the modified time immediately after title and body edits', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: {
        scenario: 'sample',
        fileModifiedTimes: {
          '/ws/sample/Prompts/Examples/Simple Greeting.prompt.md': OLD_PROMPT_MODIFIED_AT,
          '/ws/sample/Prompts/Development/Code Review.prompt.md': OLD_PROMPT_MODIFIED_AT
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
