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

async function waitForVirtualWindowControls(window: any): Promise<void> {
  await window.waitForFunction(() => Boolean(window.svelteVirtualWindowTestControls))
}

async function getVirtualWindowTestId(window: any, selector: string): Promise<string> {
  const testId = await window.evaluate(
    ({ targetSelector }) => {
      const element = document.querySelector<HTMLElement>(targetSelector)
      return element?.getAttribute('data-testid') ?? null
    },
    { targetSelector: selector }
  )

  if (!testId) {
    throw new Error(`Failed to resolve data-testid for selector: ${selector}`)
  }

  return testId
}

async function waitForVirtualWindowScrollTopControl(window: any, testId: string): Promise<void> {
  await window.waitForFunction((targetTestId) => {
    const controls = window.svelteVirtualWindowTestControls
    if (!controls?.getScrollTop) return false
    return typeof controls.getScrollTop(targetTestId) === 'number'
  }, testId)
}

async function waitForVirtualWindowScrollHeightControl(window: any, testId: string): Promise<void> {
  await window.waitForFunction((targetTestId) => {
    const controls = window.svelteVirtualWindowTestControls
    if (!controls?.getScrollHeight) return false
    return typeof controls.getScrollHeight(targetTestId) === 'number'
  }, testId)
}

export async function getPromptRowHeight(window: any, selector: string): Promise<number> {
  return getBoundingClientRectDimension(window, selector, 'height')
}

export async function getPromptRowWidth(window: any, selector: string): Promise<number> {
  return getBoundingClientRectDimension(window, selector, 'width')
}

export async function getElementScrollTop(window: any, selector: string): Promise<number> {
  await waitForVirtualWindowControls(window)
  const testId = await getVirtualWindowTestId(window, selector)
  await waitForVirtualWindowScrollTopControl(window, testId)
  const scrollTop = await window.evaluate(
    ({ targetTestId }) => {
      const controls = window.svelteVirtualWindowTestControls
      const value = controls?.getScrollTop?.(targetTestId)
      if (typeof value === 'number') return Math.round(value)
      return null
    },
    { targetTestId: testId }
  )

  if (scrollTop == null) {
    throw new Error(`Failed to read scrollTop for selector: ${selector}`)
  }

  return scrollTop
}

export async function getVirtualWindowScrollHeight(window: any, selector: string): Promise<number> {
  await waitForVirtualWindowControls(window)
  const testId = await getVirtualWindowTestId(window, selector)
  await waitForVirtualWindowScrollHeightControl(window, testId)
  const scrollHeight = await window.evaluate(
    ({ targetTestId }) => {
      const controls = window.svelteVirtualWindowTestControls
      const value = controls?.getScrollHeight?.(targetTestId)
      if (typeof value === 'number') return Math.round(value)
      return null
    },
    { targetTestId: testId }
  )

  if (scrollHeight == null) {
    throw new Error(`Failed to read scrollHeight for selector: ${selector}`)
  }

  return scrollHeight
}

export async function scrollVirtualWindowTo(
  window: any,
  selector: string,
  scrollTopPx: number
): Promise<void> {
  await waitForVirtualWindowControls(window)
  const testId = await getVirtualWindowTestId(window, selector)
  await waitForVirtualWindowScrollTopControl(window, testId)

  const didScroll = await window.evaluate(
    ({ targetTestId, targetScrollTopPx }) => {
      const controls = window.svelteVirtualWindowTestControls
      if (!controls?.scrollTo) return false
      controls.scrollTo(targetTestId, Math.round(targetScrollTopPx))
      return true
    },
    { targetTestId: testId, targetScrollTopPx: scrollTopPx }
  )

  if (!didScroll) {
    throw new Error(`Failed to scroll virtual window for selector: ${selector}`)
  }
}

export async function scrollVirtualWindowBy(
  window: any,
  selector: string,
  deltaPx: number
): Promise<void> {
  await waitForVirtualWindowControls(window)
  const testId = await getVirtualWindowTestId(window, selector)
  await waitForVirtualWindowScrollTopControl(window, testId)

  const didScroll = await window.evaluate(
    ({ targetTestId, targetDeltaPx }) => {
      const controls = window.svelteVirtualWindowTestControls
      if (!controls?.getScrollTop || !controls?.scrollTo) return false
      const currentTop = controls.getScrollTop(targetTestId)
      if (typeof currentTop !== 'number') return false
      controls.scrollTo(targetTestId, currentTop + targetDeltaPx)
      return true
    },
    { targetTestId: testId, targetDeltaPx: deltaPx }
  )

  if (!didScroll) {
    throw new Error(`Failed to scroll virtual window for selector: ${selector}`)
  }
}

export async function scrollVirtualElementIntoView(
  window: any,
  hostSelector: string,
  targetSelector: string,
  paddingPx = 8
): Promise<void> {
  await waitForVirtualWindowControls(window)
  await window.waitForSelector(targetSelector, { state: 'attached' })

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const measurement = await window.evaluate(
      ({ targetHostSelector, targetElementSelector, targetPaddingPx }) => {
        const host = document.querySelector<HTMLElement>(targetHostSelector)
        const target = document.querySelector<HTMLElement>(targetElementSelector)
        if (!host || !target) return null

        const hostRect = host.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const topLimit = hostRect.top + targetPaddingPx
        const bottomLimit = hostRect.bottom - targetPaddingPx
        const targetFits = targetRect.height <= bottomLimit - topLimit
        const isVisible = targetFits
          ? targetRect.top >= topLimit && targetRect.bottom <= bottomLimit
          : targetRect.top <= topLimit && targetRect.bottom >= bottomLimit

        if (isVisible) {
          return { deltaPx: 0, isVisible: true }
        }

        const deltaPx =
          targetRect.top < topLimit ? targetRect.top - topLimit : targetRect.bottom - bottomLimit

        return { deltaPx: Math.round(deltaPx), isVisible: false }
      },
      {
        targetHostSelector: hostSelector,
        targetElementSelector: targetSelector,
        targetPaddingPx: paddingPx
      }
    )

    if (!measurement) {
      throw new Error(`Failed to measure virtual element for selector: ${targetSelector}`)
    }
    if (measurement.isVisible || measurement.deltaPx === 0) {
      return
    }

    await scrollVirtualWindowBy(window, hostSelector, measurement.deltaPx)
    await window.waitForTimeout(20)
  }

  throw new Error(`Failed to scroll virtual element into view: ${targetSelector}`)
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
 * Selects a prompt folder from the sidebar folder selector.
 * @param window - The Playwright window instance
 * @param folderName - The display name of the folder to select
 * @param timeout - Optional timeout for the click action
 */
export async function clickPromptFolderItem(
  window: any,
  folderName: string,
  timeout = 2000
): Promise<void> {
  const displayNameByFolderName: Record<string, string> = {
    Examples: 'Example Prompts',
    Development: 'Development Tools'
  }
  const displayName = displayNameByFolderName[folderName] ?? folderName

  await window.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]').click({
    timeout
  })
  await window
    .locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]')
    .filter({ hasText: displayName })
    .first()
    .click({ timeout })
  await window.waitForSelector('[data-testid="prompt-folder-screen"]', {
    state: 'attached',
    timeout
  })
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
  return await window.evaluate(
    ({ editorSelector, titleSelector }) => {
      const promptEditors = document.querySelectorAll(editorSelector)
      const promptTitles = document.querySelectorAll(titleSelector)

      return {
        hasPromptEditors: promptEditors.length > 0,
        promptCount: promptEditors.length,
        firstPromptTitle: promptTitles[0]?.textContent || undefined
      }
    },
    {
      editorSelector: PROMPT_EDITOR_PREFIX_SELECTOR,
      titleSelector: PROMPT_TITLE_SELECTOR
    }
  )
}

/**
 * Navigates to a prompt folder from the sidebar prompt tree.
 * @param window - The Playwright window instance
 * @param folderName - The display name of the folder (e.g., 'Examples', 'Development')
 */
export async function navigateToRegularFolder(window: any, folderName: string): Promise<void> {
  await clickPromptFolderItem(window, folderName)
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
