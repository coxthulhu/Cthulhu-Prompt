import { isButtonVisible } from './ButtonHelpers'

/**
 * ===========================
 * WORKSPACE SETUP HELPERS
 * ===========================
 */

/**
 * Sets up a workspace through UI interactions using mocked file dialog
 * @param window - The Playwright window instance
 * @param timeout - Optional timeout for operations (default 3000ms)
 * @returns Promise that resolves with information about what happened
 */
export async function setupWorkspaceViaUI(
  window: any,
  timeout = 3000
): Promise<{
  setupDialogAppeared: boolean
  workspaceReady: boolean
}> {
  // Click the "Select Workspace Folder" button
  await window.click('[data-testid="select-workspace-folder-button"]')

  // Wait for potential workspace setup
  await window.waitForTimeout(2000)

  // Check if workspace setup dialog appeared and handle it
  const setupDialogVisible = await window.evaluate(() => {
    return document.querySelector('[role="dialog"]') !== null
  })

  if (setupDialogVisible) {
    // Click "Setup Workspace" button in the dialog
    await window.click('[data-testid="setup-workspace-button"]')
    await window.waitForTimeout(1000)
  }

  // Wait for workspace to be fully ready
  await window.waitForTimeout(timeout - 3000 > 0 ? timeout - 3000 : 500)

  // Check if workspace is now ready
  const workspaceReady = await isWorkspaceReady(window)

  return {
    setupDialogAppeared: setupDialogVisible,
    workspaceReady
  }
}

/**
 * Clears the current workspace through UI interactions
 * @param window - The Playwright window instance
 * @returns Promise that resolves when workspace is cleared
 */
export async function clearWorkspaceViaUI(window: any): Promise<void> {
  // Click "Close Workspace" button
  await window.click('[data-testid="close-workspace-button"]')
  await window.waitForTimeout(1000)
}

/**
 * Checks if workspace is in "ready" state
 * @param window - The Playwright window instance
 * @returns Promise resolving to true if workspace is ready
 */
export async function isWorkspaceReady(window: any): Promise<boolean> {
  return await window.evaluate(() => {
    return !!document.querySelector('[data-testid="workspace-ready-title"]')
  })
}

/**
 * Checks if workspace is in "get started" state (no workspace selected)
 * @param window - The Playwright window instance
 * @returns Promise resolving to true if in get started state
 */
export async function isWorkspaceGetStarted(window: any): Promise<boolean> {
  return await isButtonVisible(window, 'Select Workspace Folder')
}

/**
 * Gets the displayed workspace path from the UI
 * @param window - The Playwright window instance
 * @returns Promise resolving to the workspace path or null if not found
 */
export async function getDisplayedWorkspacePath(window: any): Promise<string | null> {
  return await window.evaluate(() => {
    // Look for workspace path in the "Workspace Ready" section
    const workspaceReadySection = document
      .querySelector('[data-testid="workspace-ready-title"]')
      ?.closest('div')
    if (workspaceReadySection) {
      const paragraphs = workspaceReadySection.querySelectorAll('p')
      for (const element of Array.from(paragraphs)) {
        const text = element.textContent || ''
        if (text.startsWith('Workspace: ')) {
          return text.replace('Workspace: ', '')
        }
      }
    }
    return null
  })
}
