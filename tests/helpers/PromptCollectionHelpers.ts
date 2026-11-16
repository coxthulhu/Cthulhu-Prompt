import { expect, type Page } from '@playwright/test'
import { PROMPT_EDITOR_PREFIX_SELECTOR, PROMPT_TITLE_SELECTOR } from './PromptCollectionSelectors'

/** Selectors and collection name used by the existing hydration readiness sequence. */
type PromptHydrationReadyOptions = {
  collectionName: string
  hostSelector: string
  promptSelector: string
  placeholderSelector: string
}

/**
 * Selects a prompt collection from the sidebar collection selector.
 * @param window - The Playwright window instance
 * @param collectionName - The display name or fixture name of the collection to select
 * @param timeout - Optional timeout for the click action
 */
export async function clickPromptCollectionItem(
  page: Page,
  collectionName: string,
  timeout = 2000
): Promise<void> {
  const displayNameByCollectionName: Record<string, string> = {
    Examples: 'Example Prompts',
    Development: 'Development Tools'
  }
  const displayName = displayNameByCollectionName[collectionName] ?? collectionName

  // Reuse the selected tab, treating Show All as closing its collection before opening another.
  if (await page.getByTestId('sidebar-show-all-button').isVisible()) await page.getByTestId('sidebar-show-all-button').click()
  else if (!await page.getByTestId('new-tab-screen').isVisible()) {
    const tab = page.getByTestId('work-tab').getByRole('tab').first()
    if (await tab.count()) {
      await tab.click()
      if (await page.getByTestId('sidebar-show-all-button').isVisible()) await page.getByTestId('sidebar-show-all-button').click()
    } else await page.getByTestId('new-tab-button').click()
  }
  await page.getByTestId('new-tab-search-input').fill('')
  await page.locator('[data-testid^="new-tab-collection-"]')
    .filter({ has: page.getByText(displayName, { exact: true }) }).click({ timeout })
  await page.waitForSelector('[data-testid="prompt-collection-screen"]', {
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
  page: Page,
  promptTitle: string
): Promise<{
  found: boolean
  titleText?: string
  hasPromptEditor?: boolean
}> {
  return await page.evaluate(
    ({ title, titleSelector, editorSelector }) => {
      // Look for prompt title elements
      const promptTitles = document.querySelectorAll<HTMLInputElement>(titleSelector)

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
 * Gets information about the current prompt collection screen.
 * @param window - The Playwright window instance
 * @returns Promise resolving to screen information
 */
export async function getPromptCollectionScreenInfo(page: Page): Promise<{
  hasPromptEditors: boolean
  promptCount: number
  firstPromptTitle?: string
}> {
  return await page.evaluate(
    ({ editorSelector, titleSelector }) => {
      const promptEditors = document.querySelectorAll(editorSelector)
      const promptTitles = document.querySelectorAll<HTMLInputElement>(titleSelector)

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

/** Opens the default project before selecting one task or template collection. */
export async function navigateToPromptCollections(page: Page, collectionName: string): Promise<void> {
  // Re-clicking the already active project leaves its screen and sidebar unchanged.
  await clickPromptCollectionItem(page, collectionName)
}

/** Opens a prompt collection and waits for its existing hydration-ready selectors. */
export async function openPromptCollectionAndWaitForHydrationReady(
  page: Page,
  options: PromptHydrationReadyOptions
): Promise<void> {
  await navigateToPromptCollections(page, options.collectionName)
  await page.waitForSelector(options.hostSelector, { state: 'attached' })
  await page.waitForSelector(options.promptSelector, { state: 'attached' })
  await page.waitForFunction(() => Boolean(window.svelteVirtualWindowTestControls))
  await page.waitForSelector(options.placeholderSelector, { state: 'detached' })
}

/** Drags the sidebar sash by the requested distance using the existing mouse steps. */
export async function dragSidebarHandleBy(page: Page, distance: number): Promise<void> {
  const sidebarHandle = page.locator('[data-testid="app-sidebar-resize-handle"]')
  await sidebarHandle.waitFor({ state: 'visible' })

  const handleBox = (await sidebarHandle.boundingBox())!
  const handleCenterX = handleBox.x + handleBox.width / 2
  const handleCenterY = handleBox.y + handleBox.height / 2

  await page.mouse.move(handleCenterX, handleCenterY)
  await page.mouse.down()
  await page.mouse.move(handleCenterX + distance, handleCenterY, { steps: 10 })
  await page.mouse.up()
}

/** Reads mounted prompt-editor IDs in DOM order. */
export const getPromptEditorIds = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="prompt-editor-"]'))
      .map((element) => element.getAttribute('data-testid') ?? '')
      .map((testId) => testId.replace('prompt-editor-', ''))
  })
}

/** Polls the existing mounted-editor order assertion. */
export const expectCurrentCollectionPromptEditors = async (
  page: Page,
  expectedPromptIds: string[]
): Promise<void> => {
  await expect.poll(async () => await getPromptEditorIds(page)).toEqual(expectedPromptIds)
}

/** Opens category management through the sidebar's selected-collection actions menu. */
export const openManageCategoriesFromSidebar = async (page: Page): Promise<void> => {
  await page.getByTestId('selected-prompt-collection-actions-button').click()
  await page.getByTestId('manage-categories-selected-prompt-collection-menu-item').click()
}

/** Returns the current tab to its browser, creating a tab only when none is visible. */
export async function showCollectionBrowser(page: Page): Promise<void> {
  if (await page.getByTestId('sidebar-show-all-button').isVisible()) await page.getByTestId('sidebar-show-all-button').click()
  else if (!await page.getByTestId('new-tab-screen').isVisible()) await page.getByTestId('new-tab-button').click()
}

/** Opens the first project's collection creation menu through the New Tab screen. */
export async function openCollectionCreation(page: Page, kind: 'prompt' | 'template' = 'prompt'): Promise<void> {
  await showCollectionBrowser(page)
  await page.locator('button[data-testid^="new-tab-new-collection-"]').first().click()
  await page.getByTestId('new-tab-new-collection-menu').getByRole('menuitem', { name: kind === 'prompt' ? 'Task Collection' : 'Template Collection', exact: false }).click()
}
