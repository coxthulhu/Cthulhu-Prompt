import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders } from '../fixtures/WorkspaceFixtures'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'
const LONG_SINGLE_LINE_FOLDER_NAME = 'Long Wrapped Singles'
const TARGET_INDEX = 30
const TARGET_PROMPT_ID = `measurement-${TARGET_INDEX}`
const TARGET_PROMPT_TITLE = `Measurement Prompt ${TARGET_INDEX}`
const TARGET_PROMPT_TREE_ROW_SELECTOR = `[data-testid="prompt-folder-prompt-${TARGET_PROMPT_ID}"]`
const LAST_TREE_PROMPT_SELECTOR = '[data-testid="prompt-folder-prompt-longmixed-100"]'
const SHORT_FOLDER_NAME = 'Short'
const SHORT_SCROLL_TARGET_PX = 2000
const SAMPLE_FOLDER_NAME = 'Development'
const SAMPLE_PROMPT_ID = 'dev-1'
const samplePromptTreeRowSelector = `[data-testid="prompt-folder-prompt-${SAMPLE_PROMPT_ID}"]`
const samplePromptTitleSelector = `${promptEditorSelector(SAMPLE_PROMPT_ID)} ${PROMPT_TITLE_SELECTOR}`
const UNOPENED_UNTITLED_WORKSPACE_PATH = '/ws/tree-untitled-summaries'
const LOADED_FOLDER_NAME = 'Loaded'
const UNOPENED_FOLDER_PROMPT_1_SELECTOR = '[data-testid="prompt-folder-prompt-unopened-1"]'
const UNOPENED_FOLDER_PROMPT_2_SELECTOR = '[data-testid="prompt-folder-prompt-unopened-2"]'

const scrollPromptTreeRowIntoView = async (
  mainWindow: any,
  testHelpers: any,
  rowSelector: string
) => {
  const hostHeight = await testHelpers.getPromptRowHeight(PROMPT_TREE_HOST_SELECTOR)
  const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(PROMPT_TREE_HOST_SELECTOR)
  const maxScrollTop = Math.max(0, scrollHeight - hostHeight)
  const stepPx = Math.max(1, Math.round(hostHeight * 0.8))

  for (let scrollTopPx = 0; scrollTopPx <= maxScrollTop; scrollTopPx += stepPx) {
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, scrollTopPx)
    if ((await mainWindow.locator(rowSelector).count()) > 0) {
      return
    }
  }

  throw new Error(`Missing prompt tree row: ${rowSelector}`)
}

describe('Prompt folder prompt tree', () => {
  test('keeps selected prompt centered after hydration for long wrapped singles prompt-tree jump', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'long-wrapped-lines' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(LONG_SINGLE_LINE_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await scrollPromptTreeRowIntoView(mainWindow, testHelpers, TARGET_PROMPT_TREE_ROW_SELECTOR)
    const promptTreeButton = mainWindow.locator(TARGET_PROMPT_TREE_ROW_SELECTOR)
    await expect(promptTreeButton).toHaveText(TARGET_PROMPT_TITLE)
    await promptTreeButton.click()

    await mainWindow.waitForSelector(
      `${PROMPT_FOLDER_HOST_SELECTOR} ${PROMPT_EDITOR_PREFIX_SELECTOR}`,
      { state: 'attached' }
    )

    // Wait until all visible Monaco placeholders are gone to ensure hydration completed.
    await mainWindow.waitForFunction(
      ({ hostSelector, placeholderSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        if (!host) return false
        return host.querySelectorAll(placeholderSelector).length === 0
      },
      {
        hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
        placeholderSelector: MONACO_PLACEHOLDER_SELECTOR
      }
    )

    const centeredRowId = await mainWindow.evaluate(
      ({ hostSelector, rowSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        if (!host) return null
        const hostRect = host.getBoundingClientRect()
        const centerLine = Math.round(hostRect.top + hostRect.height / 2)
        const rows = Array.from(host.querySelectorAll<HTMLElement>(rowSelector))
        const centeredRow = rows.find((row) => {
          const rect = row.getBoundingClientRect()
          return rect.top <= centerLine && rect.bottom >= centerLine
        })
        return centeredRow?.getAttribute('data-testid') ?? null
      },
      { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, rowSelector: PROMPT_EDITOR_PREFIX_SELECTOR }
    )

    const expectedCenteredRowId = `prompt-editor-${TARGET_PROMPT_ID}`
    expect(centeredRowId).toBe(expectedCenteredRowId)

    await expect(promptTreeButton).toHaveAttribute('data-active', 'true')
  })

  test('scrolls back to folder settings when selecting settings in the prompt tree', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, SHORT_SCROLL_TARGET_PX)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBeGreaterThan(0)

    const folderSettingsSelector = '[data-testid="prompt-folder-settings-Short"]'
    await mainWindow.evaluate((selector) => {
      const button = document.querySelector<HTMLButtonElement>(selector)
      if (!button) {
        throw new Error(`Missing prompt tree row: ${selector}`)
      }
      button.click()
    }, folderSettingsSelector)
    const folderSettingsButton = mainWindow.locator(folderSettingsSelector)

    await expect(folderSettingsButton).toHaveAttribute('data-active', 'true')
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBeLessThan(100)
  })

  test('updates prompt tree title while typing in title input', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SAMPLE_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    const titleInput = mainWindow.locator(samplePromptTitleSelector)
    const promptTreeRow = mainWindow.locator(samplePromptTreeRowSelector)

    await titleInput.waitFor({ state: 'visible' })
    await expect(promptTreeRow).toBeVisible()

    await titleInput.click()
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.press('Backspace')

    await mainWindow.keyboard.type('Live', { delay: 20 })
    await expect(promptTreeRow).toContainText('Live')

    const nextTitle = 'Live prompt title sync'
    await mainWindow.keyboard.type(' prompt title sync', { delay: 20 })
    await expect(promptTreeRow).toContainText(nextTitle)
  })

  test('keeps one folder row of space below the last prompt tree entry', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    const treeScrollHeight = await testHelpers.getVirtualWindowScrollHeight(PROMPT_TREE_HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, treeScrollHeight)
    await mainWindow.waitForSelector(LAST_TREE_PROMPT_SELECTOR, { state: 'attached' })

    const bottomGapPx = await mainWindow.evaluate(
      ({ hostSelector, rowSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const row = document.querySelector<HTMLElement>(rowSelector)
        if (!host || !row) return null
        const hostRect = host.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        return Math.round(hostRect.bottom - rowRect.bottom)
      },
      {
        hostSelector: PROMPT_TREE_HOST_SELECTOR,
        rowSelector: LAST_TREE_PROMPT_SELECTOR
      }
    )

    expect(bottomGapPx).toBeGreaterThanOrEqual(36)
  })

  test('keeps placeholder fallback numbering for unopened folders with blank titles', async ({
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(UNOPENED_UNTITLED_WORKSPACE_PATH, [
        {
          folderName: 'Loaded',
          displayName: LOADED_FOLDER_NAME,
          prompts: [
            {
              id: 'loaded-1',
              title: 'Loaded prompt',
              promptText: 'Loaded folder prompt'
            }
          ]
        },
        {
          folderName: 'UnopenedUntitled',
          displayName: 'Unopened Untitled',
          prompts: [
            {
              id: 'unopened-1',
              title: '',
              promptText: 'First unopened untitled prompt'
            },
            {
              id: 'unopened-2',
              title: '',
              promptText: 'Second unopened untitled prompt'
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([UNOPENED_UNTITLED_WORKSPACE_PATH])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(LOADED_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await expect(mainWindow.locator(UNOPENED_FOLDER_PROMPT_1_SELECTOR)).toHaveText('Prompt 1')
    await expect(mainWindow.locator(UNOPENED_FOLDER_PROMPT_2_SELECTOR)).toHaveText('Prompt 2')
  })
})
