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
export async function getActiveScreen(window: any): Promise<string> {
  return await window.evaluate(() => {
    const promptFolderHeading = document.querySelector('[data-testid="prompt-folder-screen"] h1')
    if (promptFolderHeading) {
      return 'prompt-folder'
    }

    // Check data-active attribute on sidebar menu buttons
    const activeButtons = document.querySelectorAll(
      '[data-sidebar="menu-button"][data-active="true"]'
    )

    for (const button of Array.from(activeButtons)) {
      const text = button.textContent?.toLowerCase() || ''
      if (text.includes('home')) return 'home'
      if (text.includes('settings')) return 'settings'
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
export async function navigateToHomeScreen(window: any): Promise<void> {
  await clickNavButton(window, 'Home')
}

/**
 * Navigates to the Settings screen
 * @param window - The Playwright window instance
 */
export async function navigateToSettingsScreen(window: any): Promise<void> {
  await clickNavButton(window, 'Settings')
}
