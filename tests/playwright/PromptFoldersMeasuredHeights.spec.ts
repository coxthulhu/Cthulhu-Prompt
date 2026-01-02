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
const FIRST_PROMPT_SELECTOR = '[data-testid="prompt-editor-measurement-1"]'
const LAST_SHORT_PROMPT_SELECTOR = '[data-testid="prompt-editor-short-60"]'
const MEASUREMENT_FOLDER_NAME = 'Long Wrapped Singles'
const SHORT_FOLDER_NAME = 'Short'

async function measureScrollHeight(page: Page): Promise<number> {
  await page.waitForSelector(HOST_SELECTOR, { state: 'attached' })

  const scrollHeight = await page.evaluate((selector: string) => {
    const element = document.querySelector<HTMLElement>(selector)
    if (!element) return null
    return Math.round(element.scrollHeight)
  }, HOST_SELECTOR)

  if (typeof scrollHeight !== 'number') {
    throw new Error('Failed to measure virtual window scroll height')
  }

  return scrollHeight
}

async function scrollVirtualWindowHost(page: Page): Promise<void> {
  await page.waitForSelector(HOST_SELECTOR, { state: 'attached' })

  await page.evaluate((selector: string) => {
    const host = document.querySelector<HTMLElement>(selector)
    host?.scrollTo({ top: host.scrollHeight })
  }, HOST_SELECTOR)

  await page.waitForTimeout(1500)

  await page.evaluate((selector: string) => {
    const host = document.querySelector<HTMLElement>(selector)
    host?.scrollTo({ top: 0 })
  }, HOST_SELECTOR)

  await page.waitForTimeout(1000)
}

async function scrollVirtualWindowToBottom(page: Page): Promise<void> {
  await page.waitForSelector(HOST_SELECTOR, { state: 'attached' })
  await page.evaluate((selector: string) => {
    const host = document.querySelector<HTMLElement>(selector)
    host?.scrollTo({ top: host.scrollHeight })
  }, HOST_SELECTOR)
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

    const initialScrollHeight = await measureScrollHeight(mainWindow)

    await scrollVirtualWindowHost(mainWindow)

    let scrollHeightAfterScroll = initialScrollHeight
    await expect
      .poll(async () => {
        scrollHeightAfterScroll = await measureScrollHeight(mainWindow)
        return scrollHeightAfterScroll
      })
      .toBeGreaterThan(initialScrollHeight)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(MEASUREMENT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    const scrollHeightAfterNavigation = await measureScrollHeight(mainWindow)
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
    await scrollVirtualWindowToBottom(mainWindow)
    await mainWindow.waitForSelector(LAST_SHORT_PROMPT_SELECTOR, { state: 'attached' })
    await waitForMonacoEditor(mainWindow, LAST_SHORT_PROMPT_SELECTOR)

    const scrollHeightBeforeEdit = await measureScrollHeight(mainWindow)

    // Add 20 blank lines to update the measured height.
    await focusMonacoEditor(mainWindow, LAST_SHORT_PROMPT_SELECTOR)
    await moveMonacoCursorToEnd(mainWindow, LAST_SHORT_PROMPT_SELECTOR)
    for (let i = 0; i < 20; i += 1) {
      await mainWindow.keyboard.press('Enter')
    }

    const scrollHeightAfterEdit = await measureScrollHeight(mainWindow)
    expect(scrollHeightAfterEdit).toBeGreaterThan(scrollHeightBeforeEdit)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    const scrollHeightAfterNavigation = await measureScrollHeight(mainWindow)
    expect(scrollHeightAfterNavigation).toBe(scrollHeightAfterEdit)
  })
})
