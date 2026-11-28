import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_COLLECTION_HOST_SELECTOR
} from '../helpers/PromptCollectionSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const LOADING_CHANNEL = 'load-prompt-collection-initial'
const OVERLAY_SELECTOR = '[data-testid="prompt-collection-loading-overlay"]'

describe('Prompt collection loading overlay', () => {
  test('shows during initial load, hides without fading, then stays hidden for cached revisit', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.pauseIpcChannel(LOADING_CHANNEL)
    try {
      await testHelpers.navigateToPromptCollections('Development')
      await mainWindow.waitForSelector('[data-testid="prompt-collection-screen"]', {
        state: 'attached'
      })
      await mainWindow.waitForSelector(OVERLAY_SELECTOR, { state: 'visible' })

      const overlay = mainWindow.locator(OVERLAY_SELECTOR)
      await expect(overlay.locator('text=Loading collection...')).toBeVisible()
      await expect(overlay.locator('.animate-spin')).toBeVisible()

      /** Resolves once the overlay leaves the DOM, reporting whether it entered its fading state first. */
      const overlayRemoval = await mainWindow.evaluateHandle(
        (selector) => ({
          sawFading: new Promise<boolean>((resolve) => {
            let sawFading = false
            const observer = new MutationObserver(() => {
              const overlayElement = document.querySelector<HTMLElement>(selector)
              if (overlayElement?.dataset.fading === 'true') sawFading = true
              if (overlayElement === null) {
                observer.disconnect()
                resolve(sawFading)
              }
            })
            observer.observe(document.body, {
              subtree: true,
              childList: true,
              attributes: true,
              attributeFilter: ['data-fading']
            })
          })
        }),
        OVERLAY_SELECTOR
      )

      await testHelpers.resumeIpcChannel(LOADING_CHANNEL)

      expect(await overlayRemoval.evaluate(({ sawFading }) => sawFading)).toBe(false)
      await mainWindow.waitForSelector(PROMPT_EDITOR_PREFIX_SELECTOR, { state: 'attached' })
    } finally {
      await testHelpers.resumeIpcChannel(LOADING_CHANNEL)
    }

    await testHelpers.navigateToHomeScreen()

    await testHelpers.pauseIpcChannel(LOADING_CHANNEL)
    try {
      await testHelpers.navigateToPromptCollections('Development')
      await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST_SELECTOR, { state: 'attached' })
      await mainWindow.waitForSelector(PROMPT_EDITOR_PREFIX_SELECTOR, { state: 'attached' })
      await expect(mainWindow.locator(OVERLAY_SELECTOR)).toHaveCount(0)
    } finally {
      await testHelpers.resumeIpcChannel(LOADING_CHANNEL)
    }
  })
})
