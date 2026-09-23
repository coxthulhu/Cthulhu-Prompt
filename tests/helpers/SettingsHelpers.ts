import { expect, type Page } from '@playwright/test'
import type { AuthoritativeSnapshot } from '@shared/ipc/AuthoritativeSnapshot'

/** Waits for the same persisted max-lines value used by editor tests. */
async function waitForStoredPromptMaxLines(mainWindow: Page, value: number): Promise<void> {
  await mainWindow.waitForFunction((expected) => {
    /** Preload bridge used by the existing settings readiness check. */
    const ipc = window.electron?.ipcRenderer
    if (!ipc?.invoke) return false
    return ipc.invoke('load-system-settings').then((result) => {
      /** System-settings snapshot selected without relying on response order. */
      return result?.snapshots?.find(
        (snapshot: AuthoritativeSnapshot) => snapshot.entityType === 'systemSettings'
      )?.data?.promptEditorMaxLines === expected
    })
  }, value)
}

/** Changes max lines through Settings, then returns Home after the existing value check. */
export async function setPromptEditorMaxLines(
  mainWindow: Page,
  testHelpers: {
    navigateToSettingsScreen: () => Promise<void>
    navigateToHomeScreen: () => Promise<void>
  },
  value: number
): Promise<void> {
  await testHelpers.navigateToSettingsScreen()
  /** Settings control whose value is checked before leaving the screen. */
  const input = mainWindow.locator('[data-testid="max-lines-input"]')
  await input.fill(String(value))
  await expect(input).toHaveValue(String(value))
  await testHelpers.navigateToHomeScreen()
  await waitForStoredPromptMaxLines(mainWindow, value)
}
