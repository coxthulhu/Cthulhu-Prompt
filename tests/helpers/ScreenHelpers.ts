import type { Page } from '@playwright/test'
import { clickNavButton } from './ButtonHelpers'

/**
 * ===========================
 * SCREEN DETECTION HELPERS
 * ===========================
 */

/**
 * Detects which screen is currently active based on UI state
 * @param window - The Playwright window instance
 * @returns Promise resolving to the active screen name
 */
export async function getActiveScreen(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const promptFolderScreen = document.querySelector('[data-testid="prompt-folder-screen"]')
    if (promptFolderScreen) {
      return 'prompt-folder'
    }

    // Check data-active on icon-only activity buttons and any remaining nav buttons.
    const activeButtons = document.querySelectorAll(
      '[data-active="true"][data-testid^="nav-button-"]'
    )

    for (const button of Array.from(activeButtons)) {
      const text = `${button.textContent?.toLowerCase() || ''} ${button.getAttribute('aria-label')?.toLowerCase() || ''}`
      if (text.includes('home')) return 'home'
      if (text.includes('settings')) return 'settings'
      if (text.includes('mockups')) return 'mockups'
      if (text.includes('test screen')) return 'test-screen'
      if (text.includes('test folder') || text.includes('project prompts')) return 'prompt-folder'
    }

    return 'unknown'
  })
}

/**
 * ===========================
 * SCREEN NAVIGATION UTILITIES
 * ===========================
 */

/**
 * Navigates to the Home screen
 * @param window - The Playwright window instance
 */
export async function navigateToHomeScreen(page: Page): Promise<void> {
  await clickNavButton(page, 'Home')
}

/**
 * Navigates to the Settings screen
 * @param window - The Playwright window instance
 */
export async function navigateToSettingsScreen(page: Page): Promise<void> {
  await clickNavButton(page, 'Settings')
}
