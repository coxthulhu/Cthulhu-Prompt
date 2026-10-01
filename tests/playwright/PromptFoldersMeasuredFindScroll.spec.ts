import type { Page } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'

/** Shared Windows Electron fixtures and assertions for measured find navigation. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Find input addressed independently of editor focus. */
const FIND_INPUT = '[data-testid="prompt-find-input"]'
/** Unique query found only in the configured target section. */
const QUERY = 'needle-measured-match'

/** Creates enough rows to require mounting a distant match without preliminary scrolling. */
const buildWorkspace = (path: string, section: 'title' | 'body', targetIndex: number) =>
  createWorkspaceWithFolders(path, [{
    folderName: 'Measured',
    displayName: 'Measured',
    promptFolderId: 'measured-folder',
    prompts: Array.from({ length: 60 }, (_, index) => ({
      id: `measured-${index + 1}`,
      title: index + 1 === targetIndex && section === 'title' ? QUERY : `Ordinary ${index + 1}`,
      promptText: index + 1 === targetIndex && section === 'body'
        ? `first line\n${QUERY}\nlast line`
        : 'one line'
    }))
  }])

/** Measures the selected match midpoint relative to the main viewport's top. */
const getMatchTopOffset = (page: Page, selector: string, section: 'title' | 'body') =>
  page.locator(`${selector} ${section === 'title' ? PROMPT_TITLE_SELECTOR : '.currentFindMatch'}`)
    .first().evaluate((match, hostSelector) => {
      /** Match geometry is available after title decoration or Monaco selection renders. */
      const rect = match.getBoundingClientRect()
      /** Main viewport bounds exclude the separate sidebar scroller. */
      const host = document.querySelector(hostSelector)!.getBoundingClientRect()
      return rect.top + rect.height / 2 - host.top
    }, PROMPT_FOLDER_HOST_SELECTOR)

describe('Measured Find Scrolling', () => {
  // Expanding a hidden category must prepare its editor without the old preliminary main scroll.
  test('expands a collapsed find category and selects its prompt before body hydration', async ({ testSetup }) => {
    /** Root prompts keep the category's find target outside the main viewport and overscan. */
    const path = '/ws/measured-find-category'
    /** Category-backed fixture searches expanded content while its sidebar path is collapsed. */
    const filesystem = createWorkspaceWithFolders(path, [{
      folderName: 'Measured', displayName: 'Measured', promptFolderId: 'measured-folder',
      prompts: [
        ...Array.from({ length: 29 }, (_, index) => ({
          id: `measured-${index + 1}`, title: `Ordinary ${index + 1}`, promptText: 'one line'
        })),
        { id: 'measured-category-target', title: QUERY, promptText: 'one line', category: 'measured-category' }
      ]
    }])
    filesystem[`${path}/Prompts/Measured/Categories/Hidden.category.json`] = JSON.stringify({
      id: 'measured-category', displayName: 'Hidden', shortDescription: null, description: null
    })
    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Window and helpers exercise category expansion through real find navigation. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Measured')
    /** Sidebar toggle collapses only the tree; main-content prompts remain searchable. */
    const toggleSelector = '[data-testid="prompt-tree-active-category-toggle-button-Hidden"]'
    await testHelpers.scrollVirtualWindowTo('[data-testid="prompt-tree-active-virtual-window"]', 1_000_000)
    await testHelpers.scrollVirtualElementIntoView('[data-testid="prompt-tree-active-virtual-window"]', toggleSelector)
    await mainWindow.locator(toggleSelector).click()
    await expect(mainWindow.locator(toggleSelector)).toHaveAttribute('aria-expanded', 'false')
    /** Distant target begins unmounted in the main viewport. */
    const selector = promptEditorSelector('measured-category-target')
    await expect(mainWindow.locator(selector)).toHaveCount(0)
    await mainWindow.evaluate(() => window.svelteVirtualWindowTestControls!.pauseMonacoHydration())
    try {
      await mainWindow.keyboard.press('Control+F')
      await mainWindow.locator(FIND_INPUT).fill(QUERY)
      /** Previously unmounted prompt is now prepared inside its expanded category. */
      await expect(mainWindow.locator(`${selector} ${MONACO_PLACEHOLDER_SELECTOR}`)).toBeAttached()
      await expect(mainWindow.locator(toggleSelector)).toHaveAttribute('aria-expanded', 'true')
      await expect(mainWindow.getByTestId('prompt-tree-active-prompt-measured-category-target'))
        .toHaveAttribute('aria-current', 'true')
      expect(await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)).toBe(0)
      await mainWindow.evaluate(() => window.svelteVirtualWindowTestControls!.resumeMonacoHydration())
      await waitForMonacoEditor(mainWindow, selector)
      await expect(mainWindow.locator(`${selector} ${PROMPT_TITLE_SELECTOR}`)).toBeVisible()
    } finally {
      if (!mainWindow.isClosed()) {
        await mainWindow.evaluate(() => window.svelteVirtualWindowTestControls!.resumeMonacoHydration())
      }
    }
  })

  // Both target sections must preserve an in-band viewport and synchronously center an out-of-band match.
  for (const section of ['title', 'body'] as const) {
    test(`keeps an in-band ${section} match still and synchronously centers it outside the band`, async ({ testSetup }) => {
      /** Isolated workspace containing a nearby target that can hydrate before navigation. */
      const path = `/ws/measured-find-band-${section}`
      await testSetup.setupFilesystem(buildWorkspace(path, section, 5))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
      /** Window and helpers exercise real input events and virtual scroll controls. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
      await testHelpers.navigateToPromptFolders('Measured')
      /** Hydrated row provides the API's synchronous measurement fast path. */
      const selector = promptEditorSelector('measured-5')
      await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 600)
      await waitForMonacoEditor(mainWindow, selector)
      await mainWindow.keyboard.press('Control+F')
      /** Find retains focus while its target section is measured. */
      const input = mainWindow.locator(FIND_INPUT)
      await input.fill(QUERY)
      if (section === 'body') await expect(mainWindow.locator(`${selector} .currentFindMatch`)).toBeVisible()
      /** Current match offset used to place the target inside the band, away from the center. */
      const initialOffset = await getMatchTopOffset(mainWindow, selector, section)
      /** Absolute scroll offset before deliberate in-band placement. */
      const initialScroll = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
      await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, initialScroll + initialOffset - 150)
      /** In-band viewport must survive incremental query typing unchanged. */
      const inBandScroll = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
      expect(Math.abs(await getMatchTopOffset(mainWindow, selector, section) - 150)).toBeLessThanOrEqual(1)
      await input.fill(QUERY.slice(0, -1))
      await expect(mainWindow.getByTestId('prompt-find-widget')).toContainText('1 of 1')
      expect(await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)).toBe(inBandScroll)
      expect(Math.abs(await getMatchTopOffset(mainWindow, selector, section) - 150)).toBeLessThanOrEqual(1)

      await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, inBandScroll + 90)
      expect(Math.abs(await getMatchTopOffset(mainWindow, selector, section) - 60)).toBeLessThanOrEqual(1)
      /** Input and scroll reads share one browser task, proving the hydrated path does not defer adjustment. */
      const immediateScroll = await mainWindow.evaluate(({ query, inputSelector, matchSelector }) => {
        /** Native input receives the same input event as ordinary typing. */
        const input = document.querySelector<HTMLTextAreaElement>(inputSelector)!
        /** Scroll offset before and after synchronous query handling. */
        const before = window.svelteVirtualWindowTestControls!.getScrollTop!('prompt-folder-virtual-window')
        /** Existing match and viewport bounds determine the exact same-task scroll destination. */
        const matchRect = document.querySelector(matchSelector)!.getBoundingClientRect()
        /** Main viewport midpoint used by centered placement. */
        const hostRect = document.querySelector('[data-testid="prompt-folder-virtual-window"]')!.getBoundingClientRect()
        /** Expected raw offset before rendering any deferred changes. */
        const expected = before! + matchRect.top + matchRect.height / 2 - (hostRect.top + hostRect.height / 2)
        input.value = query
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return { expected, after: window.svelteVirtualWindowTestControls!.getScrollTop!('prompt-folder-virtual-window') }
      }, {
        query: QUERY,
        inputSelector: FIND_INPUT,
        matchSelector: `${selector} ${section === 'title' ? PROMPT_TITLE_SELECTOR : '.currentFindMatch'}`
      })
      expect(Math.abs(immediateScroll.after! - immediateScroll.expected)).toBeLessThanOrEqual(1)
      await expect.poll(async () => {
        /** Viewport midpoint is the expected position when the match is outside the 100px band. */
        const viewportHeight = await mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR).evaluate((host) => host.clientHeight)
        return Math.abs(await getMatchTopOffset(mainWindow, selector, section) - viewportHeight / 2)
      }).toBeLessThanOrEqual(1)
      await expect(input).toBeFocused()
    })
  }

  // Each action must invalidate a distant row while hydration is deliberately held pending.
  for (const action of ['clear', 'close', 'wheel-at-top', 'scrollbar-press', 'navigation', 'new-query'] as const) {
    test(`cancels a pending measured reveal on ${action}`, async ({ testSetup }) => {
      /** Isolated folder with its only match far outside the normal overscan window. */
      const path = `/ws/measured-find-cancel-${action}`
      await testSetup.setupFilesystem(buildWorkspace(path, 'title', 30))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
      /** Window and helpers expose the hydration pause without replacing real navigation. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
      await mainWindow.waitForFunction(() => Boolean(window.svelteVirtualWindowTestControls))
      await mainWindow.evaluate(() => window.svelteVirtualWindowTestControls!.pauseMonacoHydration())
      try {
        await testHelpers.navigateToPromptFolders('Measured')
        await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
        await mainWindow.keyboard.press('Control+F')
        /** Distant title forces mounting while its Monaco body remains unhydrated. */
        const input = mainWindow.locator(FIND_INPUT)
        await input.fill(QUERY)
        /** Pending target must mount without a preliminary viewport adjustment. */
        const selector = promptEditorSelector('measured-30')
        await expect(mainWindow.locator(`${selector} ${MONACO_PLACEHOLDER_SELECTOR}`)).toBeAttached()
        expect(await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)).toBe(0)

        if (action === 'clear') await input.fill('')
        else if (action === 'close') await mainWindow.getByTestId('prompt-find-close').click()
        else if (action === 'wheel-at-top') {
          await mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR).dispatchEvent('wheel', { deltaY: -100 })
        } else if (action === 'scrollbar-press') {
          /** Thumb press counts as user intent even before any pointer movement. */
          const thumb = mainWindow.locator(`${PROMPT_FOLDER_HOST_SELECTOR}`).locator('..').locator('.virtual-window-scrollbar-thumb')
          await mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR).hover()
          /** Real pointer coordinates allow the scrollbar to capture an active drag pointer. */
          const thumbBounds = (await thumb.boundingBox())!
          await mainWindow.mouse.move(thumbBounds.x + thumbBounds.width / 2, thumbBounds.y + thumbBounds.height / 2)
          await mainWindow.mouse.down()
          await mainWindow.mouse.up()
        } else if (action === 'navigation') {
          await testHelpers.scrollVirtualWindowTo('[data-testid="prompt-tree-active-virtual-window"]', 0)
          await mainWindow.getByTestId('prompt-tree-active-prompt-measured-1').click()
        } else {
          await input.fill('Ordinary 1')
        }
        await expect(mainWindow.locator(selector)).toHaveCount(0)
        /** Latest viewport placement must remain authoritative when the queue resumes. */
        const cancelledScroll = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
        await mainWindow.evaluate(() => window.svelteVirtualWindowTestControls!.resumeMonacoHydration())
        await waitForMonacoEditor(mainWindow, promptEditorSelector('measured-1'))
        expect(await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)).toBe(cancelledScroll)
        await expect(mainWindow.locator(selector)).toHaveCount(0)
      } finally {
        if (!mainWindow.isClosed()) {
          await mainWindow.evaluate(() => window.svelteVirtualWindowTestControls!.resumeMonacoHydration())
        }
      }
    })
  }
})
