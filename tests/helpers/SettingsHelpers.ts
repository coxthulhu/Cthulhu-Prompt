import { expect, type Page } from '@playwright/test'
import type { AuthoritativeSnapshot } from '@shared/ipc/AuthoritativeSnapshot'
import type { NewPromptFocus } from '@shared/domain/settings/SystemSettings'

/** Changes automatic updates in Settings and waits until main has committed the preference. */
export async function setAutomaticUpdates(
  mainWindow: Page,
  testHelpers: { navigateToSettingsScreen: () => Promise<void> },
  enabled: boolean
): Promise<void> {
  await testHelpers.navigateToSettingsScreen()
  /** Existing toggle exposes its value through its accessible pressed state. */
  const toggle = mainWindow.getByTestId('automatic-updates-toggle')
  if ((await toggle.getAttribute('aria-pressed')) !== String(enabled)) await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', String(enabled))
  await mainWindow.waitForFunction(async (expected) => {
    /** Committed state is the same preference read by the main-process updater. */
    const result = await window.electron.ipcRenderer.invoke('load-system-settings')
    return result.snapshots.find(
      (snapshot: AuthoritativeSnapshot) => snapshot.entityType === 'systemSettings'
    )?.data?.automaticUpdates === expected
  }, enabled)
}

/** Chooses creation focus through the dropdown and waits for the authoritative setting. */
export async function setNewPromptFocus(
  mainWindow: Page,
  testHelpers: { navigateToSettingsScreen: () => Promise<void> },
  value: NewPromptFocus
): Promise<void> {
  await testHelpers.navigateToSettingsScreen()
  await mainWindow.getByTestId('new-prompt-focus-selector').click()
  await mainWindow.getByTestId(`new-prompt-focus-option-${value}`).click()
  await expect(mainWindow.getByTestId('new-prompt-focus-selector')).toHaveText(
    value === 'title' ? 'Title' : 'Editor'
  )
  await mainWindow.waitForFunction(async (expected) => {
    /** Authoritative settings confirm that the dropdown change crossed IPC. */
    const result = await window.electron.ipcRenderer.invoke('load-system-settings')
    return result.snapshots.find(
      (snapshot: AuthoritativeSnapshot) => snapshot.entityType === 'systemSettings'
    )?.data?.newPromptFocus === expected
  }, value)
}

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
