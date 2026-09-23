import type { Page } from '@playwright/test'
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
export async function setupWorkspaceViaUI(page: Page): Promise<{
  setupDialogAppeared: boolean
  workspaceReady: boolean
}> {
  await page.click('[data-testid="open-workspace-button"]')

  const workspaceReadyPath = page.locator('[data-testid="workspace-ready-path"]')
  const WORKSPACE_SETUP_TIMEOUT_MS = 10000

  await workspaceReadyPath.waitFor({ state: 'visible', timeout: WORKSPACE_SETUP_TIMEOUT_MS })

  const workspaceReady = await isWorkspaceReady(page)

  return {
    setupDialogAppeared: false,
    workspaceReady
  }
}

export async function createWorkspaceViaUI(page: Page): Promise<{
  setupDialogAppeared: boolean
  workspaceReady: boolean
}> {
  await page.click('[data-testid="create-workspace-button"]')

  const createDialog = page.locator('[role="dialog"][aria-label="Create Workspace"]')
  const workspaceReadyPath = page.locator('[data-testid="workspace-ready-path"]')
  const WORKSPACE_SETUP_TIMEOUT_MS = 10000

  await createDialog.waitFor({ state: 'visible', timeout: WORKSPACE_SETUP_TIMEOUT_MS })
  await page.fill('[data-testid="create-workspace-name-input"]', 'Test Workspace')
  await page.click('[data-testid="create-workspace-path-browse-button"]')
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-testid="create-workspace-submit-button"]'
    )
    return button && !button.disabled
  })
  await page.click('[data-testid="create-workspace-submit-button"]')
  await workspaceReadyPath.waitFor({ state: 'visible', timeout: WORKSPACE_SETUP_TIMEOUT_MS })

  const workspaceReady = await isWorkspaceReady(page)

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
export async function clearWorkspaceViaUI(page: Page): Promise<void> {
  // Click "Close Workspace" button
  await page.click('[data-testid="close-workspace-button"]')
  await page.waitForSelector('[data-testid="open-workspace-button"]', {
    state: 'visible',
    timeout: 5000
  })
}

/**
 * Checks if workspace is in "ready" state
 * @param window - The Playwright window instance
 * @returns Promise resolving to true if workspace is ready
 */
export async function isWorkspaceReady(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return !!document.querySelector('[data-testid="workspace-ready-path"]')
  })
}

/**
 * Checks if workspace is in "get started" state (no workspace selected)
 * @param window - The Playwright window instance
 * @returns Promise resolving to true if in get started state
 */
export async function isWorkspaceGetStarted(page: Page): Promise<boolean> {
  return await isButtonVisible(page, 'Open Workspace')
}

/**
 * Gets the displayed workspace path from the UI
 * @param window - The Playwright window instance
 * @returns Promise resolving to the workspace path or null if not found
 */
export async function getDisplayedWorkspacePath(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return document.querySelector('[data-testid="workspace-ready-path"]')?.textContent ?? null
  })
}
