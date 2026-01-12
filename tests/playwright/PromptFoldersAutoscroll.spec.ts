import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR
const TITLE_SELECTOR = PROMPT_TITLE_SELECTOR
const FIRST_PROMPT_SELECTOR = promptEditorSelector('virtualization-test-1')

describe('Prompt Folders Autoscroll', () => {
  test('scrolls title input to 100px from bottom when typing', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    // Align the first offscreen title input to the bottom of the viewport.
    const target = await mainWindow.evaluate(
      ({ hostSelector, titleSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        if (!host) return null
        const hostRect = host.getBoundingClientRect()
        const inputs = Array.from(host.querySelectorAll<HTMLInputElement>(titleSelector))
        const candidate = inputs
          .map((input) => ({ input, rect: input.getBoundingClientRect() }))
          .filter(({ rect }) => rect.top >= hostRect.bottom)
          .sort((a, b) => a.rect.top - b.rect.top)[0]
        if (!candidate) return null

        const row = candidate.input.closest('[data-prompt-editor-row]') as HTMLElement | null
        const promptTestId = row?.getAttribute('data-testid')
        if (!promptTestId) return null

        host.scrollTop += candidate.rect.bottom - hostRect.bottom

        return { promptTestId }
      },
      { hostSelector: HOST_SELECTOR, titleSelector: TITLE_SELECTOR }
    )

    if (!target?.promptTestId) {
      throw new Error('Failed to find a prompt title below the viewport.')
    }

    const targetSelector = `[data-testid="${target.promptTestId}"] ${TITLE_SELECTOR}`

    await mainWindow.waitForFunction(
      ({ hostSelector, targetSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const input = document.querySelector<HTMLInputElement>(targetSelector)
        if (!host || !input) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const inputBottom = input.getBoundingClientRect().bottom
        return Math.abs(Math.round(hostBottom - inputBottom)) <= 2
      },
      { hostSelector: HOST_SELECTOR, targetSelector }
    )

    const input = mainWindow.locator(targetSelector)
    await input.click()
    await input.type('Autoscroll check')

    await mainWindow.waitForFunction(
      ({ hostSelector, targetSelector, targetDistance, tolerance }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const input = document.querySelector<HTMLInputElement>(targetSelector)
        if (!host || !input) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const rect = input.getBoundingClientRect()
        const inputCenter = rect.top + rect.height / 2
        const distance = Math.round(hostBottom - inputCenter)
        return Math.abs(distance - targetDistance) <= tolerance
      },
      { hostSelector: HOST_SELECTOR, targetSelector, targetDistance: 100, tolerance: 2 }
    )

    const finalDistance = await mainWindow.evaluate(
      ({ hostSelector, targetSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const input = document.querySelector<HTMLInputElement>(targetSelector)
        if (!host || !input) return null
        const hostBottom = host.getBoundingClientRect().bottom
        const rect = input.getBoundingClientRect()
        const inputCenter = rect.top + rect.height / 2
        return Math.round(hostBottom - inputCenter)
      },
      { hostSelector: HOST_SELECTOR, targetSelector }
    )

    if (finalDistance == null) {
      throw new Error('Failed to measure the final input position.')
    }

    expect(Math.abs(finalDistance - 100)).toBeLessThanOrEqual(2)
  })
})
