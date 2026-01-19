import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_FOLDER_SPACER_SELECTOR,
  PROMPT_TITLE_SELECTOR
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR
const SPACER_SELECTOR = PROMPT_FOLDER_SPACER_SELECTOR

const FIRST_PROMPT_SELECTOR = '[data-testid="prompt-editor-virtualization-test-1"]'
const LAST_PROMPT_SELECTOR = '[data-testid="prompt-editor-virtualization-test-50"]'
const PROMPT_PREFIX_SELECTOR = '[data-testid^="prompt-editor-virtualization-test-"]'

describe('Prompt Folders Virtualization', () => {
  test('renders the first prompt with expected content', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    const firstPromptTitleInput = mainWindow.locator(
      `${FIRST_PROMPT_SELECTOR} ${PROMPT_TITLE_SELECTOR}`
    )
    await firstPromptTitleInput.waitFor({ state: 'visible', timeout: 6000 })
    await expect(firstPromptTitleInput).toHaveValue('Large Prompt 1')

    const promptInfo = await testHelpers.verifyPromptVisible('Large Prompt 1')
    expect(promptInfo.found).toBe(true)
    expect(promptInfo.hasPromptEditor).toBe(true)
  })

  test('does not render distant prompts before scrolling', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    const lastPromptInitiallyLoaded = await mainWindow.evaluate(
      ({ selector }) => Boolean(document.querySelector(selector)),
      { selector: LAST_PROMPT_SELECTOR }
    )
    expect(lastPromptInitiallyLoaded).toBe(false)

    const initialEditorCount = await mainWindow.evaluate(({ selector }) => {
      return document.querySelectorAll(selector).length
    }, PROMPT_PREFIX_SELECTOR)
    expect(initialEditorCount).toBeLessThan(50)

    await mainWindow.evaluate(
      ({ selector }) => {
        const host = document.querySelector<HTMLElement>(selector)
        host?.scrollTo({ top: host.scrollHeight })
      },
      { selector: HOST_SELECTOR }
    )

    await mainWindow.waitForFunction(({ selector }) => Boolean(document.querySelector(selector)), {
      selector: LAST_PROMPT_SELECTOR
    })
  })

  test('renders a scrollable spacer for virtualization', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    const metrics = await mainWindow.evaluate(
      ({ hostSelector, spacerSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const spacer = document.querySelector<HTMLElement>(spacerSelector)
        if (!host || !spacer) return null
        return {
          scrollHeight: Math.round(host.scrollHeight),
          clientHeight: Math.round(host.clientHeight),
          spacerHeight: Math.round(spacer.offsetHeight)
        }
      },
      {
        hostSelector: HOST_SELECTOR,
        spacerSelector: SPACER_SELECTOR
      }
    )

    expect(metrics).not.toBeNull()
    expect(metrics?.scrollHeight).toBeGreaterThan(metrics?.clientHeight ?? 0)
    expect(metrics?.spacerHeight).toBeGreaterThan(metrics?.clientHeight ?? 0)
  })
})
