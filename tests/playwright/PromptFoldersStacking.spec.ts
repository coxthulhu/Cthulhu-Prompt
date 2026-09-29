import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_FOLDER_HOST_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'

/** Shared Electron fixtures and browser assertions for the stacking regression. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Prompt folder stacking', () => {
  test('keeps Monaco overflow widgets above screen chrome and below dialogs', async ({ testSetup }) => {
    /** A scrollable folder exposes the scrollbar and top scroll shadow together. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })
    await testHelpers.navigateToPromptFolders('Short')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 100)
    await mainWindow.getByTestId('prompt-folder-find-button').click()
    await expect(mainWindow.getByTestId('prompt-find-widget')).toBeVisible()

    // Mount a deterministic widget through Monaco's real overflow path, without language services.
    await expect.poll(() => mainWindow.evaluate((hostSelector) => {
      /** Visible viewport used to choose a fully visible editor anchor. */
      const viewport = document.querySelector<HTMLElement>(hostSelector)!
      /** Bounds keep the widget's anchor away from virtualized overscan rows. */
      const bounds = viewport.getBoundingClientRect()
      /** Hydrated editor whose first line can host an overflowing content widget. */
      const entry = window.__cthulhuMonacoEditors?.find(({ container }) => {
        /** Editor bounds used to exclude partially visible anchors. */
        const rect = container.getBoundingClientRect()
        return viewport.contains(container) && rect.top >= bounds.top + 40 && rect.bottom <= bounds.bottom
      })
      if (!entry) return false
      /** Clickable content widget kept in the same ancestry as real Monaco popups. */
      const button = document.createElement('button')
      button.dataset.testid = 'stacking-overflow-widget'
      button.textContent = 'Widget'
      button.style.cssText = 'width:80px;height:24px;pointer-events:auto;'
      // Record real pointer delivery without moving the folder or opening another control.
      button.onclick = () => { button.dataset.clicked = 'true' }
      entry.editor.addContentWidget({
        allowEditorOverflow: true,
        /** Stable identity for the test-only Monaco widget. */
        getId: () => 'stacking-overflow-widget',
        /** Monaco owns placement and parenting of this actual content widget. */
        getDomNode: () => button,
        /** Place above the first line, using Monaco's ABOVE preference. */
        getPosition: () => ({ position: { lineNumber: 1, column: 1 }, preference: [1] })
      })
      return true
    }, PROMPT_FOLDER_HOST_SELECTOR)).toBe(true)

    /** The widget must use the virtualizer's overflow layer, outside clipped editor cards. */
    const widget = mainWindow.getByTestId('stacking-overflow-widget')
    await expect(widget).toBeVisible()
    await expect(mainWindow.locator('.virtual-window-overlay').filter({ has: widget })).toHaveCount(1)
    await expect(mainWindow.locator('.prompt-folder-header-bar')).toHaveCSS('z-index', '20')
    await expect(mainWindow.locator('.prompt-find-widget-host')).toHaveCSS('z-index', '20')

    /** Overlapping boundaries that previously painted above editor overflow widgets. */
    const targets = [
      '.prompt-folder-header-bar',
      '.prompt-find-widget-host',
      '[data-testid="prompt-folder-screen"] .virtual-window-scroll-shadow',
      '[data-testid="prompt-folder-screen"] .virtual-window-scrollbar-track'
    ]
    for (const selector of targets) {
      // Keep the scrollbar revealed while measuring each overlap.
      await mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR).hover({ position: { x: 2, y: 100 } })
      await expect(mainWindow.locator('[data-testid="prompt-folder-screen"] .virtual-window-scrollbar'))
        .toHaveClass(/\bvisible\b/)
      /** A shared hit point puts the widget over the actual target without changing its layer. */
      const point = await mainWindow.evaluate((targetSelector) => {
        /** Underlying screen element being covered by the editor widget. */
        const target = document.querySelector<HTMLElement>(targetSelector)!
        /** Widget whose transform only controls the overlap geometry. */
        const node = document.querySelector<HTMLElement>('[data-testid="stacking-overflow-widget"]')!
        /** Target center stays inside even the three-pixel shadow. */
        const rect = target.getBoundingClientRect()
        /** Overlap point in viewport coordinates. */
        const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        node.style.transform = 'none'
        /** Monaco's current widget position before the test's translation. */
        const origin = node.getBoundingClientRect()
        node.style.transform = `translate(${point.x - origin.left - origin.width / 2}px, ${point.y - origin.top - origin.height / 2}px)`
        node.dataset.clicked = 'false'
        // Make the decorative shadow hit-testable to detect its paint order, without changing z-index.
        if (target.classList.contains('virtual-window-scroll-shadow')) target.style.pointerEvents = 'auto'
        return point
      }, selector)
      expect(await mainWindow.evaluate(({ x, y }) =>
        Boolean(document.elementFromPoint(x, y)?.closest('[data-testid="stacking-overflow-widget"]')),
      point), selector).toBe(true)
      await mainWindow.mouse.click(point.x, point.y)
      await expect(widget).toHaveAttribute('data-clicked', 'true')
    }

    // The portaled modal backdrop must cover the same editor widget, even outside the dialog card.
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await mainWindow.getByTestId('prompt-folder-root-title-edit').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Rename Folder' })).toBeVisible()
    await expect(widget).toBeVisible()
    expect(await widget.evaluate((node) => {
      /** Widget center remains under the dialog backdrop at the scrollbar edge. */
      const rect = node.getBoundingClientRect()
      /** Actual overlap point must remain inside the window after revealing the root header. */
      const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      return {
        insideWindow: point.x > 0 && point.x < window.innerWidth && point.y > 0 && point.y < window.innerHeight,
        coveredByDialog: Boolean(document.elementFromPoint(point.x, point.y)?.closest('.cthulhuUiDialogLayer'))
      }
    })).toEqual({ insideWindow: true, coveredByDialog: true })
  })
})
