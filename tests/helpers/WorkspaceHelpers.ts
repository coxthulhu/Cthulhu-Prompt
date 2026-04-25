import { isButtonVisible } from './ButtonHelpers'

/**
 * ===========================
 * WORKSPACE SETUP HELPERS
 * ===========================
 */

/**
 * Selects an existing workspace through UI interactions using mocked file dialog
 * @param window - The Playwright window instance
 * @returns Promise that resolves with information about what happened
 */
export async function setupWorkspaceViaUI(window: any): Promise<{
  setupDialogAppeared: boolean
  workspaceReady: boolean
}> {
  await window.click('[data-testid="select-workspace-folder-button"]')

  const workspaceReadyTitle = window.locator('[data-testid="workspace-ready-title"]')
  const WORKSPACE_SETUP_TIMEOUT_MS = 10000

  await workspaceReadyTitle.waitFor({ state: 'visible', timeout: WORKSPACE_SETUP_TIMEOUT_MS })

  const workspaceReady = await isWorkspaceReady(window)

  return {
    setupDialogAppeared: false,
    workspaceReady
  }
}

export async function createWorkspaceViaUI(window: any): Promise<{
  setupDialogAppeared: boolean
  workspaceReady: boolean
}> {
  await window.click('[data-testid="create-workspace-folder-button"]')

  const setupDialog = window.locator('[role="dialog"]')
  const workspaceReadyTitle = window.locator('[data-testid="workspace-ready-title"]')
  const WORKSPACE_SETUP_TIMEOUT_MS = 10000

  await setupDialog.waitFor({ state: 'visible', timeout: WORKSPACE_SETUP_TIMEOUT_MS })
  await window.click('[data-testid="setup-workspace-button"]')
  await workspaceReadyTitle.waitFor({ state: 'visible', timeout: WORKSPACE_SETUP_TIMEOUT_MS })

  const workspaceReady = await isWorkspaceReady(window)

  return {
    setupDialogAppeared: true,
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
  await window.waitForSelector('[data-testid="select-workspace-folder-button"]', {
    state: 'visible',
    timeout: 5000
  })
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
    return document.querySelector('[data-testid="workspace-ready-path"]')?.textContent ?? null
  })
}
