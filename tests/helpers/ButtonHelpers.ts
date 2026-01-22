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
export async function isButtonVisible(window: any, buttonText: string): Promise<boolean> {
  // Map common button text to their data-testid
  const buttonMap: Record<string, string> = {
    'Select Workspace Folder': 'select-workspace-folder-button',
    'Create Workspace Folder': 'create-workspace-folder-button',
    'Close Workspace': 'close-workspace-button',
    'New Prompt Folder': 'new-prompt-folder-button',
    'Test Folder': 'regular-prompt-folder-TestFolder', // Created folders use folderName without spaces
    'Example Prompts': 'regular-prompt-folder-Examples',
    'Development Tools': 'regular-prompt-folder-Development'
  }

  const testId = buttonMap[buttonText]
  if (testId) {
    return await window.evaluate((testId: string) => {
      return !!document.querySelector(`[data-testid="${testId}"]`)
    }, testId)
  }

  // If no mapping found, fall back to text search (but this should be avoided)
  return await window.evaluate((text: string) => {
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
export async function isNavButtonActive(window: any, buttonText: string): Promise<boolean> {
  return await window.evaluate((text: string) => {
    const buttons = document.querySelectorAll('[data-sidebar="menu-button"]')
    for (const button of Array.from(buttons)) {
      if (button.textContent?.includes(text) && button.getAttribute('data-active') === 'true') {
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
  window: any,
  buttonText: string,
  timeout = 2000
): Promise<void> {
  // Map navigation button text to their data-testid
  const navButtonMap: Record<string, string> = {
    Home: 'nav-button-home',
    Settings: 'nav-button-settings'
  }

  const testId = navButtonMap[buttonText]
  if (testId) {
    await window.click(`[data-testid="${testId}"]`, { timeout })
  } else {
    // Fallback for unmapped buttons (should be avoided)
    await window.click(`button:has-text("${buttonText}")`, { timeout })
  }
  await window.waitForTimeout(500) // Wait for navigation to complete
}
