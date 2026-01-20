import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { PROMPT_FOLDER_HOST_SELECTOR } from '../helpers/PromptFolderSelectors'
import {
  focusMonacoEditor,
  moveMonacoCursorToEnd,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR
const FIRST_PROMPT_SELECTOR = '[data-testid="prompt-editor-measurement-1"]'
const LAST_SHORT_PROMPT_SELECTOR = '[data-testid="prompt-editor-short-60"]'
const MEASUREMENT_FOLDER_NAME = 'Long Wrapped Singles'
const SHORT_FOLDER_NAME = 'Short'

describe('Prompt folders measured heights', () => {
  test('persists measured padding after navigation', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'long-wrapped-lines' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(MEASUREMENT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    const initialScrollHeight = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)

    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, scrollHeight)
    await mainWindow.waitForTimeout(1500)
    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, 0)
    await mainWindow.waitForTimeout(1000)

    let scrollHeightAfterScroll = initialScrollHeight
    await expect
      .poll(async () => {
        scrollHeightAfterScroll = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
        return scrollHeightAfterScroll
      })
      .toBeGreaterThan(initialScrollHeight)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(MEASUREMENT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    const scrollHeightAfterNavigation = await testHelpers.getVirtualWindowScrollHeight(
      HOST_SELECTOR
    )
    expect(scrollHeightAfterNavigation).toBe(scrollHeightAfterScroll)
  })

  test('keeps measured height cached after editing and navigation', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    // Jump to the last prompt editor in the large list of small prompts.
    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, scrollHeight)
    await mainWindow.waitForSelector(LAST_SHORT_PROMPT_SELECTOR, { state: 'attached' })
    await waitForMonacoEditor(mainWindow, LAST_SHORT_PROMPT_SELECTOR)

    const scrollHeightBeforeEdit = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)

    // Add 20 blank lines to update the measured height.
    await focusMonacoEditor(mainWindow, LAST_SHORT_PROMPT_SELECTOR)
    await moveMonacoCursorToEnd(mainWindow, LAST_SHORT_PROMPT_SELECTOR)
    for (let i = 0; i < 20; i += 1) {
      await mainWindow.keyboard.press('Enter')
    }

    const scrollHeightAfterEdit = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
    expect(scrollHeightAfterEdit).toBeGreaterThan(scrollHeightBeforeEdit)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    const scrollHeightAfterNavigation = await testHelpers.getVirtualWindowScrollHeight(
      HOST_SELECTOR
    )
    expect(scrollHeightAfterNavigation).toBe(scrollHeightAfterEdit)
  })
})
