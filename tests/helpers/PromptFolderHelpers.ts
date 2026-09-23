import { expect, type Page } from '@playwright/test'
import { PROMPT_EDITOR_PREFIX_SELECTOR, PROMPT_TITLE_SELECTOR } from './PromptFolderSelectors'

/** Selectors and folder name used by the existing hydration readiness sequence. */
type PromptHydrationReadyOptions = {
  folderName: string
  hostSelector: string
  promptSelector: string
  placeholderSelector: string
}

/**
 * Selects a prompt folder from the sidebar folder selector.
 * @param window - The Playwright window instance
 * @param folderName - The display name of the folder to select
 * @param timeout - Optional timeout for the click action
 */
export async function clickPromptFolderItem(
  page: Page,
  folderName: string,
  timeout = 2000
): Promise<void> {
  const displayNameByFolderName: Record<string, string> = {
    Examples: 'Example Prompts',
    Development: 'Development Tools'
  }
  const displayName = displayNameByFolderName[folderName] ?? folderName

  await page.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]').click({
    timeout
  })
  await page
    .locator('[data-testid^="sidebar-prompt-folder-dropdown-item-"]')
    .filter({ hasText: displayName })
    .first()
    .click({ timeout })
  await page.waitForSelector('[data-testid="prompt-folder-screen"]', {
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
 * Gets information about the current prompt folder screen.
 * @param window - The Playwright window instance
 * @returns Promise resolving to screen information
 */
export async function getPromptFolderScreenInfo(page: Page): Promise<{
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

/** Opens the task-prompt activity before selecting one task-prompt root. */
export async function navigateToPromptFolders(page: Page, folderName: string): Promise<void> {
  await page.locator('[data-testid="nav-button-prompt-task-folders"]').click()
  await clickPromptFolderItem(page, folderName)
}

/** Opens the template activity before selecting one prompt-template root. */
export async function navigateToTemplateFolder(page: Page, folderName: string): Promise<void> {
  await page.locator('[data-testid="nav-button-prompt-template-folders"]').click()
  await clickPromptFolderItem(page, folderName)
}

/** Opens a prompt root and waits for its existing hydration-ready selectors. */
export async function openPromptFolderAndWaitForHydrationReady(
  page: Page,
  options: PromptHydrationReadyOptions
): Promise<void> {
  await navigateToPromptFolders(page, options.folderName)
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
export const expectCurrentFolderPromptEditors = async (
  page: Page,
  expectedPromptIds: string[]
): Promise<void> => {
  await expect.poll(async () => await getPromptEditorIds(page)).toEqual(expectedPromptIds)
}
