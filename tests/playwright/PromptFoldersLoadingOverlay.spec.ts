import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const LOADING_CHANNEL = 'load-prompt-folder-initial'
const OVERLAY_SELECTOR = '[data-testid="prompt-folder-loading-overlay"]'

describe('Prompt folder loading overlay', () => {
  test('shows during initial load, fades out, then stays hidden for cached revisit', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.pauseIpcChannel(LOADING_CHANNEL)
    try {
      await testHelpers.navigateToPromptFolders('Development')
      await mainWindow.waitForSelector('[data-testid="prompt-folder-screen"]', { state: 'attached' })
      await mainWindow.waitForSelector(OVERLAY_SELECTOR, { state: 'visible' })

      const overlay = mainWindow.locator(OVERLAY_SELECTOR)
      await expect(overlay.locator('text=Loading prompt folder...')).toBeVisible()
      await expect(overlay.locator('.animate-spin')).toBeVisible()
      await expect(overlay).toHaveAttribute('style', /transition-duration:\s*125ms/)

      await testHelpers.resumeIpcChannel(LOADING_CHANNEL)

      await mainWindow.waitForFunction((selector) => {
        const overlayElement = document.querySelector<HTMLElement>(selector)
        return overlayElement?.classList.contains('opacity-0') ?? false
      }, OVERLAY_SELECTOR)
      await mainWindow.waitForSelector(OVERLAY_SELECTOR, { state: 'detached' })
      await mainWindow.waitForSelector(PROMPT_EDITOR_PREFIX_SELECTOR, { state: 'attached' })
    } finally {
      await testHelpers.resumeIpcChannel(LOADING_CHANNEL)
    }

    await testHelpers.navigateToHomeScreen()

    await testHelpers.pauseIpcChannel(LOADING_CHANNEL)
    try {
      await testHelpers.navigateToPromptFolders('Development')
      await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
      await mainWindow.waitForSelector(PROMPT_EDITOR_PREFIX_SELECTOR, { state: 'attached' })
      await expect(mainWindow.locator(OVERLAY_SELECTOR)).toHaveCount(0)
    } finally {
      await testHelpers.resumeIpcChannel(LOADING_CHANNEL)
    }
  })
})
