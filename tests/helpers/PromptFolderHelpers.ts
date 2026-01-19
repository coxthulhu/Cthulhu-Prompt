/**
 * ===========================
 * VIRTUAL PROMPT FOLDER NAVIGATION HELPERS
 * ===========================
 */

async function getBoundingClientRectDimension(
  window: any,
  selector: string,
  dimension: 'height' | 'width'
): Promise<number> {
  const result = await window.evaluate(
    ({ targetSelector, targetDimension }) => {
      const element = document.querySelector<HTMLElement>(targetSelector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return Math.round(rect[targetDimension])
    },
    { targetSelector: selector, targetDimension: dimension }
  )

  if (result == null) {
    throw new Error(`Failed to read ${dimension} for selector: ${selector}`)
  }

  return result
}

export async function getPromptRowHeight(window: any, selector: string): Promise<number> {
  return getBoundingClientRectDimension(window, selector, 'height')
}

export async function getPromptRowWidth(window: any, selector: string): Promise<number> {
  return getBoundingClientRectDimension(window, selector, 'width')
}

export async function getElementScrollTop(window: any, selector: string): Promise<number> {
  const scrollTop = await window.evaluate(
    ({ targetSelector }) => {
      const element = document.querySelector<HTMLElement>(targetSelector)
      if (!element) return null
      return Math.round(element.scrollTop)
    },
    { targetSelector: selector }
  )

  if (scrollTop == null) {
    throw new Error(`Failed to read scrollTop for selector: ${selector}`)
  }

  return scrollTop
}

type PromptHydrationReadyOptions = {
  folderName: string
  hostSelector: string
  promptSelector: string
  placeholderSelector: string
}

/**
 * Clicks a collapsible trigger button (like My Prompts Virtual dropdown)
 * @param window - The Playwright window instance
 * @param triggerText - The text to find in the trigger button
 * @param timeout - Optional timeout for the click action
 */
export async function clickCollapsibleTrigger(_window: any, _triggerText: string): Promise<void> {
  // Sidebar no longer uses collapsibles; keep function for backward compatibility.
  return
}

/**
 * Clicks on a specific prompt folder item in the My Prompts dropdown.
 * @param window - The Playwright window instance
 * @param folderName - The name of the folder to click (used in data-testid)
 * @param timeout - Optional timeout for the click action
 */
export async function clickPromptFolderItem(
  window: any,
  folderName: string,
  timeout = 2000
): Promise<void> {
  const safeName = folderName.replace(/\s+/g, '')
  const testId = `regular-prompt-folder-${safeName}`

  await window.click(`[data-testid="${testId}"]`, { timeout })
  await window.waitForTimeout(1000)
}

export async function clickPromptFoldersUpdatedItem(
  window: any,
  folderName: string,
  timeout = 2000
): Promise<void> {
  const safeName = folderName.replace(/\s+/g, '')
  const testId = `prompt-folders-updated-folder-${safeName}`

  await window.click(`[data-testid="${testId}"]`, { timeout })
  await window.waitForTimeout(1000)
}

/**
 * Verifies that a prompt is visible on the page with the correct title
 * @param window - The Playwright window instance
 * @param promptTitle - The expected prompt title
 * @returns Promise resolving to verification result
 */
export async function verifyPromptVisible(
  window: any,
  promptTitle: string
): Promise<{
  found: boolean
  titleText?: string
  hasPromptEditor?: boolean
}> {
  return await window.evaluate(
    ({ title, titleSelector, editorSelector }) => {
      // Look for prompt title elements
      const promptTitles = document.querySelectorAll(titleSelector)

      for (const titleElement of Array.from(promptTitles)) {
        // For Input elements, check the value property; for other elements, check textContent
        const titleText = titleElement.value || titleElement.textContent || ''
        if (titleText.includes(title)) {
          // Check if there's a corresponding prompt editor
          const promptEditor = titleElement.closest(editorSelector)
          return {
            found: true,
            titleText: titleText,
            hasPromptEditor: !!promptEditor
          }
        }
      }

      return { found: false }
    },
    {
      title: promptTitle,
      titleSelector: PROMPT_TITLE_SELECTOR,
      editorSelector: PROMPT_EDITOR_PREFIX_SELECTOR
    }
  )
}

/**
 * Gets information about the current prompt folder screen.
 * @param window - The Playwright window instance
 * @returns Promise resolving to screen information
 */
export async function getPromptFolderScreenInfo(window: any): Promise<{
  hasPromptEditors: boolean
  promptCount: number
  firstPromptTitle?: string
}> {
  return await window.evaluate(({ editorSelector, titleSelector }) => {
    const promptEditors = document.querySelectorAll(editorSelector)
    const promptTitles = document.querySelectorAll(titleSelector)

    return {
      hasPromptEditors: promptEditors.length > 0,
      promptCount: promptEditors.length,
      firstPromptTitle: promptTitles[0]?.textContent || undefined
    }
  }, {
    editorSelector: PROMPT_EDITOR_PREFIX_SELECTOR,
    titleSelector: PROMPT_TITLE_SELECTOR
  })
}

/**
 * Navigates to a prompt folder within the "My Prompts" section.
 * The collapsible will be expanded if needed before the folder button is pressed.
 * @param window - The Playwright window instance
 * @param folderName - The display name of the folder (e.g., 'Examples', 'Development')
 */
export async function navigateToRegularFolder(window: any, folderName: string): Promise<void> {
  await clickPromptFolderItem(window, folderName)
}

export async function navigateToPromptFoldersUpdated(
  window: any,
  folderName: string
): Promise<void> {
  await navigateToRegularFolder(window, folderName)
}

export async function openPromptFolderAndWaitForHydrationReady(
  window: any,
  options: PromptHydrationReadyOptions
): Promise<void> {
  await navigateToRegularFolder(window, options.folderName)
  await window.waitForSelector(options.hostSelector, { state: 'attached' })
  await window.waitForSelector(options.promptSelector, { state: 'attached' })
  await window.waitForFunction(() => Boolean(window.svelteVirtualWindowTestControls))
  await window.waitForSelector(options.placeholderSelector, { state: 'detached' })
}

export async function dragSidebarHandleBy(window: any, distance: number): Promise<void> {
  const sidebarHandle = window.locator('[data-testid="app-sidebar-resize-handle"]')
  await sidebarHandle.waitFor({ state: 'visible' })

  const handleBox = (await sidebarHandle.boundingBox())!
  const handleCenterX = handleBox.x + handleBox.width / 2
  const handleCenterY = handleBox.y + handleBox.height / 2

  await window.mouse.move(handleCenterX, handleCenterY)
  await window.mouse.down()
  await window.mouse.move(handleCenterX + distance, handleCenterY, { steps: 10 })
  await window.mouse.up()
}
import { PROMPT_EDITOR_PREFIX_SELECTOR, PROMPT_TITLE_SELECTOR } from './PromptFolderSelectors'
