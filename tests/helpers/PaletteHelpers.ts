import type { Locator } from '@playwright/test'

/** Resolves one palette token within the original caller's DOM scope. */
export const resolvePaletteColor = async (locator: Locator, token: string): Promise<string> => {
  /** Single browser evaluation preserves the original probe scope and timing. */
  const colors = await resolvePaletteColors(locator, [token])
  return colors[0]!
}

// Resolves palette tokens through Chromium so CSS assertions use the browser's color format.
export const resolvePaletteColors = async (locator: Locator, tokens: readonly string[]): Promise<string[]> =>
  await locator.evaluate((element, paletteTokens) => {
    return paletteTokens.map((token) => {
      // The temporary probe asks Chromium to compute one palette token as a color.
      const probe = document.createElement('span')
      probe.style.color = `var(${token})`
      element.appendChild(probe)
      // The computed color is stable across the fill and border properties under test.
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
  }, tokens)
