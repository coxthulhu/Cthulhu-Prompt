/**
 * ===========================
 * GENERAL UI VALIDATION HELPERS
 * ===========================
 */

/**
 * Checks for basic page structure elements
 * @param window - The Playwright window instance
 * @returns Promise resolving to structure validation results
 */
export async function validatePageStructure(window: any): Promise<{
  hasMainElement: boolean
  hasSidebar: boolean
  hasWelcomeText: boolean
}> {
  return await window.evaluate(() => {
    const hasMainElement = !!document.querySelector('main')
    const hasSidebar = !!document.querySelector('[data-sidebar]')
    const hasWelcomeText = !!document.querySelector('[data-testid="home-title"]')

    return {
      hasMainElement,
      hasSidebar,
      hasWelcomeText
    }
  })
}
