import type { Page } from '@playwright/test'
/**
 * ===========================
 * BUTTON INTERACTION HELPERS
 * ===========================
 */

/**
 * Checks if a button with specific text is visible on the page
 * @param window - The Playwright window instance
 * @param buttonText - The text to search for in buttons
 * @returns Promise resolving to true if button is visible
 */
export async function isButtonVisible(page: Page, buttonText: string): Promise<boolean> {
  // Map common button text to their data-testid
  const buttonMap: Record<string, string> = {
    'Open Workspace': 'open-workspace-button',
    'Create Workspace': 'create-workspace-button',
    'Close Workspace': 'close-workspace-button'
  }

  const testId = buttonMap[buttonText]
  if (testId) {
    return await page.evaluate((testId: string) => {
      return !!document.querySelector(`[data-testid="${testId}"]`)
    }, testId)
  }

  // If no mapping found, fall back to text search (but this should be avoided)
  return await page.evaluate((text: string) => {
    const buttons = document.querySelectorAll('button')
    for (const button of Array.from(buttons)) {
      if (button.textContent?.includes(text)) return true
    }
    return false
  }, buttonText)
}

/**
 * Checks if a navigation button has active state
 * @param window - The Playwright window instance
 * @param buttonText - The text of the button to check
 * @returns Promise resolving to true if button is active
 */
export async function isNavButtonActive(page: Page, buttonText: string): Promise<boolean> {
  return await page.evaluate((text: string) => {
    const buttons = document.querySelectorAll('[data-testid^="nav-button-"]')
    for (const button of Array.from(buttons)) {
      const label = `${button.textContent ?? ''} ${button.getAttribute('aria-label') ?? ''}`
      if (label.includes(text) && button.getAttribute('data-active') === 'true') {
        return true
      }
    }
    return false
  }, buttonText)
}

/**
 * ===========================
 * NAVIGATION HELPERS
 * ===========================
 */

/**
 * Safely clicks a navigation button and waits for the action to complete
 * @param window - The Playwright window instance
 * @param buttonText - The text of the button to click
 * @param timeout - Optional timeout for the click action
 */
export async function clickNavButton(
  page: Page,
  buttonText: string,
  timeout = 2000
): Promise<void> {
  // Map navigation button text to their data-testid
  const navButtonMap: Record<string, string> = {
    Home: 'nav-button-home',
    'Task Prompts': 'nav-button-prompt-task-folders',
    'Prompt Templates': 'nav-button-prompt-template-folders',
    Settings: 'nav-button-settings',
    Mockups: 'nav-button-mockups',
    'Test Screen': 'nav-button-test-screen'
  }

  const testId = navButtonMap[buttonText]
  if (testId) {
    await page.click(`[data-testid="${testId}"]`, { timeout })
    await page.waitForSelector(`[data-testid="${testId}"][data-active="true"]`, {
      state: 'attached',
      timeout
    })
  } else {
    // Fallback for unmapped buttons (should be avoided)
    await page.click(`button:has-text("${buttonText}")`, { timeout })
  }
}
