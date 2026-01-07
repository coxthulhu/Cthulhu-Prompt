export async function stubClipboard(page: any): Promise<void> {
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
