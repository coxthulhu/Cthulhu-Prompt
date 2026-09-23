import type { Page } from '@playwright/test'

/** Installs the per-page clipboard stub used by copy tests. */
export async function stubClipboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as any).__testClipboardText = ''
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          ;(window as any).__testClipboardText = text
        },
        readText: async () => (window as any).__testClipboardText ?? ''
      },
      configurable: true
    })
  })
}

/** Reads the stub without changing whitespace or line endings. */
export async function readClipboardText(page: Page): Promise<string> {
  return await page.evaluate(() => (window as any).__testClipboardText ?? '')
}
