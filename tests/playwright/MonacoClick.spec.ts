import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  focusMonacoEditor,
  getMonacoCursorPosition,
  isMonacoEditorFocused,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import type { Page } from '@playwright/test'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR
const TWENTY_LINE_FOLDER_NAME = 'Placeholder Height'
const PENULTIMATE_TWENTY_LINE_EDITOR = promptEditorSelector('placeholder-99')
const LAST_TWENTY_LINE_EDITOR = promptEditorSelector('placeholder-100')
/** Prompt whose content exceeds the default Monaco maximum height. */
const FORTY_LINE_EDITOR = promptEditorSelector('height-test-10')

type MonacoLinePoint = {
  x: number
  y: number
  lineTop: number
  lineBottom: number
  hostTop: number
  hostBottom: number
}

async function getMonacoLinePoint(
  page: Page,
  editorSelector: string,
  lineNumber: number
): Promise<MonacoLinePoint | null> {
  return await page.evaluate(
    ({ hostSelector, editorSelector, lineNumber }) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      const row = document.querySelector<HTMLElement>(editorSelector)
      if (!host || !row) return null

      const monacoRoot = Array.from(row.querySelectorAll<HTMLElement>('.monaco-editor')).find(
        (candidate) => candidate.querySelector('.view-lines')
      )
      if (!monacoRoot) return null

      const registry = (
        window as unknown as {
          __cthulhuMonacoEditors?: Array<{
            container: HTMLElement | null
            editor: {
              getLayoutInfo: () => { contentLeft: number }
              getModel: () => { getLineCount: () => number } | null
              getScrolledVisiblePosition: (position: {
                lineNumber: number
                column: number
              }) => { top: number; height: number } | null
            }
          }>
        }
      ).__cthulhuMonacoEditors

      const entry = registry?.find((item) => {
        if (!item?.container) return false
        return item.container === monacoRoot || item.container.contains(monacoRoot)
      })
      const model = entry?.editor.getModel()
      if (!entry || !model || lineNumber < 1 || lineNumber > model.getLineCount()) return null

      const visiblePosition = entry.editor.getScrolledVisiblePosition({
        lineNumber,
        column: 1
      })
      if (!visiblePosition) return null

      const hostRect = host.getBoundingClientRect()
      const monacoRect = monacoRoot.getBoundingClientRect()
      const lineTop = monacoRect.top + visiblePosition.top
      const lineHeight = visiblePosition.height

      return {
        x: Math.round(monacoRect.left + entry.editor.getLayoutInfo().contentLeft + 12),
        y: Math.round(lineTop + lineHeight / 2),
        lineTop: Math.round(lineTop),
        lineBottom: Math.round(lineTop + lineHeight),
        hostTop: Math.round(hostRect.top),
        hostBottom: Math.round(hostRect.bottom)
      }
    },
    { hostSelector: HOST_SELECTOR, editorSelector, lineNumber }
  )
}

async function waitForMonacoLineVisibleInHost(
  page: Page,
  editorSelector: string,
  lineNumber: number
): Promise<void> {
  await expect
    .poll(async () => {
      const point = await getMonacoLinePoint(page, editorSelector, lineNumber)
      return point ? point.y >= point.hostTop && point.y <= point.hostBottom : false
    })
    .toBe(true)
}

async function clickMonacoLine(
  page: Page,
  editorSelector: string,
  lineNumber: number
): Promise<void> {
  await waitForMonacoLineVisibleInHost(page, editorSelector, lineNumber)
  const point = await getMonacoLinePoint(page, editorSelector, lineNumber)
  if (!point) {
    throw new Error(`Failed to measure visible Monaco line ${lineNumber} in ${editorSelector}.`)
  }
  await page.mouse.click(point.x, point.y)
}

/** Returns the internal vertical scroll offset for one hydrated Monaco editor. */
async function getEditorScrollTop(page: Page, editorSelector: string): Promise<number | null> {
  return await page.evaluate((selector) => {
    /** Hydrated Monaco root used to match the editor test registry entry. */
    const monacoNode = document.querySelector(`${selector} .monaco-editor`)
    /** Registered Monaco instance associated with the requested prompt editor. */
    const entry = window.__cthulhuMonacoEditors?.find(
      (item) => item.container === monacoNode || item.container?.contains(monacoNode)
    )
    return entry ? Math.round(entry.editor.getScrollTop()) : null
  }, editorSelector)
}

/** Sets the internal vertical scroll offset for one hydrated Monaco editor. */
async function setEditorScrollTop(
  page: Page,
  editorSelector: string,
  scrollTop: number
): Promise<void> {
  await page.evaluate(
    ({ selector, nextScrollTop }) => {
      /** Hydrated Monaco root used to match the editor test registry entry. */
      const monacoNode = document.querySelector(`${selector} .monaco-editor`)
      /** Registered Monaco instance associated with the requested prompt editor. */
      const entry = window.__cthulhuMonacoEditors?.find(
        (item) => item.container === monacoNode || item.container?.contains(monacoNode)
      )
      entry?.editor.setScrollTop(nextScrollTop)
    },
    { selector: editorSelector, nextScrollTop: scrollTop }
  )
}

async function alignFirstTwoLinesOfEditorAtViewportBottom(
  page: Page,
  testHelpers: { scrollVirtualWindowBy: (selector: string, deltaPx: number) => Promise<void> },
  editorSelector: string
): Promise<void> {
  const secondLine = await getMonacoLinePoint(page, editorSelector, 2)
  if (!secondLine) {
    throw new Error(`Failed to measure line 2 in ${editorSelector}.`)
  }

  await testHelpers.scrollVirtualWindowBy(
    HOST_SELECTOR,
    secondLine.lineBottom - secondLine.hostBottom
  )

  await expect
    .poll(async () => {
      const line = await getMonacoLinePoint(page, editorSelector, 2)
      if (!line) return Number.POSITIVE_INFINITY
      return Math.abs(line.lineBottom - line.hostBottom)
    })
    .toBeLessThanOrEqual(2)

  await waitForMonacoLineVisibleInHost(page, editorSelector, 1)
  await waitForMonacoLineVisibleInHost(page, editorSelector, 2)
}

describe('Monaco editor clicks', () => {
  // Both wheel targets must preserve the menu and release scrolling after dismissal.
  for (const wheelTarget of ['editor', 'title'] as const) {
    test(`context menu blocks scrolling over the ${wheelTarget} until dismissed`, async ({ testSetup }) => {
      /** Forty lines make both Monaco and the surrounding folder viewport scrollable. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'height' }
      })
      await testHelpers.navigateToPromptFolders('Forty Line Prompt')
      await waitForMonacoEditor(mainWindow, FORTY_LINE_EDITOR)
      /** Editor content opens Monaco's native context menu away from the wheel target. */
      const editor = mainWindow.locator(`${FORTY_LINE_EDITOR} .view-lines`).first()
      /** Title is outside Monaco but inside the same virtual scrolling surface. */
      const title = mainWindow.locator(`${FORTY_LINE_EDITOR} ${PROMPT_TITLE_SELECTOR}`)
      /** Playwright locators pierce the menu's open shadow root. */
      const menu = mainWindow.locator('.monaco-menu-container').getByRole('menu')
      await editor.click({ button: 'right', position: { x: 160, y: 40 } })
      await expect(menu).toBeVisible()
      /** Original offsets catch either internal editor scrolling or virtual row movement. */
      const editorScrollTop = await getEditorScrollTop(mainWindow, FORTY_LINE_EDITOR)
      /** Original folder offset must remain stable for both wheel target locations. */
      const folderScrollTop = await testHelpers.getElementScrollTop(HOST_SELECTOR)
      /** Menu geometry must stay fixed while background gestures are blocked. */
      const menuBox = (await menu.boundingBox())!
      await (wheelTarget === 'editor' ? editor : title).hover({ position: { x: 20, y: 10 } })
      await mainWindow.mouse.wheel(0, 200)
      // Let browser input and two layout frames complete before asserting unchanged state.
      await mainWindow.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }))
      await expect(menu).toBeVisible()
      expect(await getEditorScrollTop(mainWindow, FORTY_LINE_EDITOR)).toBe(editorScrollTop)
      expect(await testHelpers.getElementScrollTop(HOST_SELECTOR)).toBe(folderScrollTop)
      /** Current menu position also detects unintended movement of its transformed ancestor. */
      const currentMenuBox = (await menu.boundingBox())!
      expect(Math.abs(currentMenuBox.x - menuBox.x)).toBeLessThanOrEqual(2)
      expect(Math.abs(currentMenuBox.y - menuBox.y)).toBeLessThanOrEqual(2)
      expect(await editor.evaluate((element) => element.dispatchEvent(
        new Event('touchmove', { bubbles: true, cancelable: true, composed: true })
      ))).toBe(false)
      // Composed menu events must cross its shadow boundary without being cancelled.
      expect(await menu.evaluate((element) => element.dispatchEvent(
        new Event('touchmove', { bubbles: true, cancelable: true, composed: true })
      ))).toBe(true)
      await menu.hover()
      await mainWindow.mouse.wheel(0, 200)
      // Menu wheel handling must remain available without moving the surrounding prompt list.
      await mainWindow.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }))
      await expect(menu).toBeVisible()
      expect(await getEditorScrollTop(mainWindow, FORTY_LINE_EDITOR)).toBe(editorScrollTop)
      expect(await testHelpers.getElementScrollTop(HOST_SELECTOR)).toBe(folderScrollTop)
      // Exercise both keyboard dismissal and an outside click releasing the same scroll lock.
      if (wheelTarget === 'editor') await mainWindow.keyboard.press('Escape')
      else await title.click()
      await expect(menu).toBeHidden()
      expect(await editor.evaluate((element) => element.dispatchEvent(
        new Event('touchmove', { bubbles: true, cancelable: true, composed: true })
      ))).toBe(true)
      if (wheelTarget === 'editor') {
        await focusMonacoEditor(mainWindow, FORTY_LINE_EDITOR)
        await editor.hover({ position: { x: 20, y: 10 } })
      }
      await mainWindow.mouse.wheel(0, 200)
      await expect.poll(() => wheelTarget === 'editor'
        ? getEditorScrollTop(mainWindow, FORTY_LINE_EDITOR)
        : testHelpers.getElementScrollTop(HOST_SELECTOR)
      ).toBeGreaterThan(wheelTarget === 'editor' ? editorScrollTop! : folderScrollTop)
    })
  }

  test('routes wheel scrolling according to Monaco focus and scroll boundaries', async ({
    testSetup
  }) => {
    /** Height fixture supplies a prompt that overflows Monaco and the folder viewport. */
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'height' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Forty Line Prompt')
    await waitForMonacoEditor(mainWindow, FORTY_LINE_EDITOR)

    /** Monaco root receives each synthetic wheel input at a stable visible point. */
    const monacoRoot = mainWindow.locator(`${FORTY_LINE_EDITOR} .monaco-editor`).first()
    /** Title focus explicitly leaves Monaco unfocused for the first wheel assertion. */
    const titleInput = mainWindow.locator(`${FORTY_LINE_EDITOR} ${PROMPT_TITLE_SELECTOR}`)
    await titleInput.focus()
    await expect.poll(() => isMonacoEditorFocused(mainWindow, FORTY_LINE_EDITOR)).toBe(false)
    await monacoRoot.hover({ position: { x: 40, y: 20 } })

    /** Unfocused Monaco scroll offset must remain fixed while the folder screen moves. */
    const unfocusedEditorScrollTop = await getEditorScrollTop(mainWindow, FORTY_LINE_EDITOR)
    await mainWindow.mouse.wheel(0, 200)
    await expect
      .poll(() => testHelpers.getElementScrollTop(HOST_SELECTOR))
      .toBeGreaterThan(0)
    expect(await getEditorScrollTop(mainWindow, FORTY_LINE_EDITOR)).toBe(
      unfocusedEditorScrollTop
    )

    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, 0)
    await setEditorScrollTop(mainWindow, FORTY_LINE_EDITOR, 0)
    await focusMonacoEditor(mainWindow, FORTY_LINE_EDITOR)
    await monacoRoot.hover({ position: { x: 40, y: 20 } })
    await mainWindow.mouse.wheel(0, 200)

    await expect.poll(() => getEditorScrollTop(mainWindow, FORTY_LINE_EDITOR)).toBeGreaterThan(0)
    expect(await testHelpers.getElementScrollTop(HOST_SELECTOR)).toBeLessThanOrEqual(2)

    await setEditorScrollTop(mainWindow, FORTY_LINE_EDITOR, 100_000)
    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, 0)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, FORTY_LINE_EDITOR)).toBe(true)
    await expect.poll(() => getEditorScrollTop(mainWindow, FORTY_LINE_EDITOR)).toBeGreaterThan(0)
    await monacoRoot.hover({ position: { x: 40, y: 20 } })
    await mainWindow.mouse.wheel(0, 200)

    await expect
      .poll(() => testHelpers.getElementScrollTop(HOST_SELECTOR))
      .toBeGreaterThan(0)
  })

  test('keeps the editor attached after clicking a word', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')

    const editorSelector = promptEditorSelector('dev-1')
    const monacoSelector = await waitForMonacoEditor(mainWindow, editorSelector)
    /** Original editor node must survive the asynchronous highlighting request. */
    const originalEditor = (await mainWindow.locator(monacoSelector).elementHandle())!
    const firstLine = mainWindow.locator(`${monacoSelector} .view-line`).first()
    await firstLine.waitFor({ state: 'visible' })
    const firstLineBox = await firstLine.boundingBox()
    expect(firstLineBox).not.toBeNull()
    await mainWindow.mouse.click(firstLineBox!.x + 12, firstLineBox!.y + firstLineBox!.height / 2)
    // Occurrence decorations prove the asynchronous word-highlighting request has rendered.
    await expect(mainWindow.locator(
      `${monacoSelector} :is(.wordHighlight, .wordHighlightText, .wordHighlightStrong)`
    ).first()).toBeVisible()
    await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
    expect(await originalEditor.evaluate((element) => element.isConnected)).toBe(true)
    await originalEditor.dispose()

    const modelState = await mainWindow.evaluate((selector) => {
      const root = document.querySelector(selector)
      const monacoRoot = root?.querySelector('.monaco-editor')
      const editorEntry = window.__cthulhuMonacoEditors?.find((entry) => {
        const domNode = entry.editor.getDomNode()
        return !!domNode && !!monacoRoot && monacoRoot.contains(domNode)
      })
      return {
        hasModel: editorEntry?.editor.getModel() != null,
        occurrencesHighlight: editorEntry?.editor.getRawOptions().occurrencesHighlight,
        text: editorEntry?.editor.getValue() ?? ''
      }
    }, editorSelector)

    expect(modelState.hasModel).toBe(true)
    expect(modelState.occurrencesHighlight).not.toBe('off')
    expect(modelState.text).toContain('Please review this code')
  })

  test('does not scroll a partially visible editor back to its previous cursor line when clicked', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual-placeholder' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(TWENTY_LINE_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, scrollHeight)
    await mainWindow.waitForSelector(LAST_TWENTY_LINE_EDITOR, { state: 'attached' })
    await waitForMonacoEditor(mainWindow, LAST_TWENTY_LINE_EDITOR)

    await clickMonacoLine(mainWindow, LAST_TWENTY_LINE_EDITOR, 20)
    await expect
      .poll(async () => getMonacoCursorPosition(mainWindow, LAST_TWENTY_LINE_EDITOR))
      .toMatchObject({ lineNumber: 20 })

    await alignFirstTwoLinesOfEditorAtViewportBottom(
      mainWindow,
      testHelpers,
      LAST_TWENTY_LINE_EDITOR
    )

    const otherTitleInput = mainWindow.locator(
      `${PENULTIMATE_TWENTY_LINE_EDITOR} ${PROMPT_TITLE_SELECTOR}`
    )
    await expect(otherTitleInput).toBeVisible()
    const otherTitleBox = await otherTitleInput.boundingBox()
    if (!otherTitleBox) {
      throw new Error('Failed to measure the penultimate prompt title input.')
    }
    await mainWindow.mouse.click(otherTitleBox.x + 12, otherTitleBox.y + otherTitleBox.height / 2)
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, LAST_TWENTY_LINE_EDITOR))
      .toBe(false)

    const scrollTopBeforeClick = await testHelpers.getElementScrollTop(HOST_SELECTOR)
    await clickMonacoLine(mainWindow, LAST_TWENTY_LINE_EDITOR, 1)
    await expect.poll(() => getMonacoCursorPosition(mainWindow, LAST_TWENTY_LINE_EDITOR))
      .toMatchObject({ lineNumber: 1 })
    await expect.poll(() => isMonacoEditorFocused(mainWindow, LAST_TWENTY_LINE_EDITOR)).toBe(true)
    const scrollTopAfterClick = await testHelpers.getElementScrollTop(HOST_SELECTOR)

    expect(Math.abs(scrollTopAfterClick - scrollTopBeforeClick)).toBeLessThanOrEqual(2)
  })
})
