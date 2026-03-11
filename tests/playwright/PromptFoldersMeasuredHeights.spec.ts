import type { Page } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { PROMPT_FOLDER_HOST_SELECTOR } from '../helpers/PromptFolderSelectors'
import {
  focusMonacoEditor,
  moveMonacoCursorToEnd,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR
const PROMPT_TREE_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'
const FIRST_PROMPT_SELECTOR = '[data-testid="prompt-editor-measurement-1"]'
const LAST_SHORT_PROMPT_SELECTOR = '[data-testid="prompt-editor-short-60"]'
const MEASUREMENT_FOLDER_NAME = 'Long Wrapped Singles'
const SHORT_FOLDER_NAME = 'Short'
const LONG_FOLDER_NAME = 'Long'
const TINY_SCROLL_TARGET_PX = 10

const getActivePromptTreeEntryTestId = async (mainWindow: Page): Promise<string | null> => {
  return await mainWindow.evaluate((hostSelector) => {
    const host = document.querySelector<HTMLElement>(hostSelector)
    if (!host) return null
    const activeButton = host.querySelector<HTMLButtonElement>(
      'button[data-active="true"][data-testid^="prompt-folder-"]'
    )
    return activeButton?.getAttribute('data-testid') ?? null
  }, PROMPT_TREE_SELECTOR)
}

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
    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, 0)

    let scrollHeightAfterScroll = initialScrollHeight
    await expect
      .poll(async () => {
        scrollHeightAfterScroll = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
        return scrollHeightAfterScroll
      })
      .toBeGreaterThanOrEqual(initialScrollHeight)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(MEASUREMENT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    const scrollHeightAfterNavigation =
      await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
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

    const scrollHeightAfterNavigation =
      await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
    expect(scrollHeightAfterNavigation).toBe(scrollHeightAfterEdit)
  })

  test('restores prompt folder scroll position after navigation and folder switches', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, 900)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(HOST_SELECTOR))
      .toBeGreaterThan(0)

    const savedScrollTop = await testHelpers.getElementScrollTop(HOST_SELECTOR)
    expect(savedScrollTop).toBeGreaterThan(0)
    await mainWindow.waitForSelector(PROMPT_TREE_SELECTOR, { state: 'attached' })
    await expect
      .poll(async () => getActivePromptTreeEntryTestId(mainWindow))
      .not.toBeNull()
    const savedPromptTreeEntryTestId = await getActivePromptTreeEntryTestId(mainWindow)
    if (!savedPromptTreeEntryTestId) {
      throw new Error('Expected an active prompt tree selection before navigation')
    }

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    const restoredScrollTop = await testHelpers.getElementScrollTop(HOST_SELECTOR)
    expect(restoredScrollTop).toBe(savedScrollTop)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(HOST_SELECTOR))
      .toBeGreaterThan(0)
    await expect
      .poll(async () => getActivePromptTreeEntryTestId(mainWindow))
      .toBe(savedPromptTreeEntryTestId)

    await testHelpers.navigateToPromptFolders(LONG_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    const restoredAfterSwitchScrollTop = await testHelpers.getElementScrollTop(HOST_SELECTOR)
    expect(restoredAfterSwitchScrollTop).toBe(savedScrollTop)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(HOST_SELECTOR))
      .toBeGreaterThan(0)
    await expect
      .poll(async () => getActivePromptTreeEntryTestId(mainWindow))
      .toBe(savedPromptTreeEntryTestId)
  })

  test('restores prompt tree selection after tiny scroll navigation restore', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, TINY_SCROLL_TARGET_PX)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(HOST_SELECTOR))
      .toBeGreaterThan(0)

    await expect
      .poll(async () => getActivePromptTreeEntryTestId(mainWindow))
      .not.toBeNull()
    const savedPromptTreeEntryTestId = await getActivePromptTreeEntryTestId(mainWindow)
    if (!savedPromptTreeEntryTestId) {
      throw new Error('Expected an active prompt tree selection before tiny-scroll navigation')
    }

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await expect
      .poll(async () => testHelpers.getElementScrollTop(HOST_SELECTOR))
      .toBeGreaterThan(0)
    await expect
      .poll(async () => getActivePromptTreeEntryTestId(mainWindow))
      .not.toBeNull()
    await expect
      .poll(async () => getActivePromptTreeEntryTestId(mainWindow))
      .toBe(savedPromptTreeEntryTestId)
  })
})
