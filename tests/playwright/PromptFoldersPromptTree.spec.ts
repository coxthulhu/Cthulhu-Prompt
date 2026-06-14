import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
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
const TARGET_PROMPT_TREE_ROW_SELECTOR = `[data-testid="prompt-tree-prompt-${TARGET_PROMPT_ID}"]`
const SHORT_FOLDER_NAME = 'Short'
const SHORT_SCROLL_TARGET_PX = 2000
const SHORT_OPTIONS_SELECTOR = '[data-testid="prompt-tree-folder-options-button-Short"]'
const SHORT_SHOW_ALL_SELECTOR = '[data-testid="prompt-tree-folder-show-all-prompts-Short"]'
const SHORT_SHOW_LESS_SELECTOR = '[data-testid="prompt-tree-folder-show-less-prompts-Short"]'
const SHORT_MENU_SHOW_ALL_SELECTOR =
  '[data-testid="prompt-tree-folder-menu-show-all-prompts-Short"]'
const SHORT_MENU_SHOW_LESS_SELECTOR =
  '[data-testid="prompt-tree-folder-menu-show-less-prompts-Short"]'
const SAMPLE_FOLDER_NAME = 'Development'
const SAMPLE_PROMPT_ID = 'dev-1'
const samplePromptTreeRowSelector = `[data-testid="prompt-tree-prompt-${SAMPLE_PROMPT_ID}"]`
const samplePromptTitleSelector = `${promptEditorSelector(SAMPLE_PROMPT_ID)} ${PROMPT_TITLE_SELECTOR}`
const UNOPENED_UNTITLED_WORKSPACE_PATH = '/ws/tree-untitled-summaries'
const LOADED_FOLDER_NAME = 'Loaded'
const UNOPENED_FOLDER_PROMPT_1_SELECTOR = '[data-testid="prompt-tree-prompt-unopened-1"]'
const UNOPENED_FOLDER_PROMPT_2_SELECTOR = '[data-testid="prompt-tree-prompt-unopened-2"]'

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

const openPromptTreeFolderOptions = async (mainWindow: any, optionsSelector: string) => {
  await mainWindow.evaluate((selector) => {
    const button = document.querySelector<HTMLButtonElement>(selector)
    if (!button) {
      throw new Error(`Missing prompt tree row: ${selector}`)
    }
    button.click()
  }, optionsSelector)
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

    await mainWindow
      .locator('[data-testid="prompt-tree-folder-show-all-prompts-LongWrappedSingles"]')
      .click()
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

    const folderSettingsSelector = '[data-testid="prompt-tree-folder-settings-menu-item-Short"]'
    await openPromptTreeFolderOptions(mainWindow, SHORT_OPTIONS_SELECTOR)

    await expect(mainWindow.getByText('Folder Options')).toHaveCount(0)
    await expect(mainWindow.locator(folderSettingsSelector)).toContainText('Open folder settings')
    await expect(mainWindow.locator(folderSettingsSelector)).not.toContainText(
      'Open folder-level settings'
    )
    await mainWindow.locator(folderSettingsSelector).click()

    await expect(mainWindow.locator(SHORT_OPTIONS_SELECTOR)).toHaveAttribute('data-active', 'true')
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

  test('caps prompt tree folders and toggles show all and show less rows', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-5"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-6"]')).toHaveCount(0)
    await expect(mainWindow.locator(SHORT_SHOW_ALL_SELECTOR)).toBeVisible()
    await expect(mainWindow.locator(SHORT_SHOW_ALL_SELECTOR)).toContainText('Show all (55 more)')

    await openPromptTreeFolderOptions(mainWindow, SHORT_OPTIONS_SELECTOR)
    await expect(mainWindow.locator(SHORT_MENU_SHOW_ALL_SELECTOR)).toContainText('Show all prompts')
    await expect(mainWindow.locator(SHORT_MENU_SHOW_LESS_SELECTOR)).toHaveCount(0)

    await mainWindow.locator(SHORT_MENU_SHOW_ALL_SELECTOR).click()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-6"]')).toBeVisible()
    await expect(mainWindow.locator(SHORT_SHOW_ALL_SELECTOR)).toHaveCount(0)

    await openPromptTreeFolderOptions(mainWindow, SHORT_OPTIONS_SELECTOR)
    await expect(mainWindow.locator(SHORT_MENU_SHOW_LESS_SELECTOR)).toContainText(
      'Show less prompts'
    )
    await expect(mainWindow.locator(SHORT_MENU_SHOW_ALL_SELECTOR)).toHaveCount(0)
    await mainWindow.keyboard.press('Escape')

    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, 10000)
    await expect(mainWindow.locator(SHORT_SHOW_LESS_SELECTOR)).toBeVisible()

    await mainWindow.evaluate((selector) => {
      const button = document.querySelector<HTMLButtonElement>(selector)
      if (!button) {
        throw new Error(`Missing prompt tree row: ${selector}`)
      }
      button.click()
    }, SHORT_SHOW_LESS_SELECTOR)
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-6"]')).toHaveCount(0)
    await expect(mainWindow.locator(SHORT_SHOW_ALL_SELECTOR)).toBeVisible()
    await expect(mainWindow.locator(SHORT_SHOW_ALL_SELECTOR)).toContainText('Show all (55 more)')

    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, 0)
    await openPromptTreeFolderOptions(mainWindow, SHORT_OPTIONS_SELECTOR)
    await expect(mainWindow.locator(SHORT_MENU_SHOW_ALL_SELECTOR)).toContainText('Show all prompts')
    await expect(mainWindow.locator(SHORT_MENU_SHOW_LESS_SELECTOR)).toHaveCount(0)
  })

  test('hides prompt visibility toggle rows while the folder is collapsed', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    const shortToggle = mainWindow.locator('[data-testid="prompt-tree-folder-toggle-button-Short"]')
    await expect(mainWindow.locator(SHORT_SHOW_ALL_SELECTOR)).toBeVisible()

    await shortToggle.click()
    await expect(shortToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(SHORT_SHOW_ALL_SELECTOR)).toHaveCount(0)
    await expect(mainWindow.locator(SHORT_SHOW_LESS_SELECTOR)).toHaveCount(0)

    await openPromptTreeFolderOptions(mainWindow, SHORT_OPTIONS_SELECTOR)
    await expect(mainWindow.locator(SHORT_MENU_SHOW_ALL_SELECTOR)).toHaveCount(0)
    await expect(mainWindow.locator(SHORT_MENU_SHOW_LESS_SELECTOR)).toHaveCount(0)
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
    await testSetup.setupFileDialog([getWorkspaceInfoPath(UNOPENED_UNTITLED_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(LOADED_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await expect(mainWindow.locator(UNOPENED_FOLDER_PROMPT_1_SELECTOR)).toHaveText('New Prompt')
    await expect(mainWindow.locator(UNOPENED_FOLDER_PROMPT_2_SELECTOR)).toHaveText('New Prompt 1')
  })
})
