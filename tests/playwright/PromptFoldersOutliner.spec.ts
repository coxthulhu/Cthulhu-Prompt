import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const OUTLINER_HOST_SELECTOR = '[data-testid="prompt-outliner-virtual-window"]'
const LONG_SINGLE_LINE_FOLDER_NAME = 'Long Wrapped Singles'
const OUTLINER_ROW_HEIGHT_PX = 28
const TARGET_INDEX = 30
const TARGET_PROMPT_ID = `measurement-${TARGET_INDEX}`
const TARGET_PROMPT_TITLE = `Measurement Prompt ${TARGET_INDEX}`

describe('Prompt folder outliner', () => {
  test('keeps selected prompt centered after hydration for long wrapped singles', async ({
    testSetup
  }) => {
    test.fail(true, 'Scroll anchoring regression: centered row lands early.')
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'long-wrapped-lines' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(LONG_SINGLE_LINE_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(OUTLINER_HOST_SELECTOR, { state: 'attached' })

    // Scroll the outliner so the 30th row is rendered before clicking it.
    await testHelpers.scrollVirtualWindowTo(
      OUTLINER_HOST_SELECTOR,
      (TARGET_INDEX - 1) * OUTLINER_ROW_HEIGHT_PX
    )

    const outlinerButton = mainWindow.locator(`${OUTLINER_HOST_SELECTOR} button`, {
      hasText: TARGET_PROMPT_TITLE
    })
    await outlinerButton.click()

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
      { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, placeholderSelector: MONACO_PLACEHOLDER_SELECTOR }
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

    await expect(outlinerButton).toHaveAttribute('aria-current', 'true')
  })
})
