import { expect, type Page } from '@playwright/test'

/** Waits for natural autosave completion and authoritative mutation reconciliation. */
export async function waitForRendererPersistence(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() =>
    window.playwrightTestControls!.hasPendingAutosaves()
  )).toBe(false)
  await page.evaluate(() => window.playwrightTestControls!.waitForMutations())
}
