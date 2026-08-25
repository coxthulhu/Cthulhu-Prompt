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

async function expectMonacoEditorToStayAttached(
  page: Page,
  editorSelector: string,
  stableDurationMs: number
): Promise<void> {
  await page.evaluate(
    ({ editorSelector, stableDurationMs }) =>
      new Promise<void>((resolve, reject) => {
        const startedAt = performance.now()
        const interval = window.setInterval(() => {
          const editor = document.querySelector(`${editorSelector} .monaco-editor`)
          const viewLines = document.querySelector(`${editorSelector} .view-lines`)

          if (!editor || !viewLines) {
            window.clearInterval(interval)
            reject(new Error('Monaco editor detached after clicking a word.'))
            return
          }

          if (performance.now() - startedAt >= stableDurationMs) {
            window.clearInterval(interval)
            resolve()
          }
        }, 50)
      }),
    { editorSelector, stableDurationMs }
  )
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
    const firstLine = mainWindow.locator(`${monacoSelector} .view-line`).first()
    await firstLine.waitFor({ state: 'visible' })
    const firstLineBox = await firstLine.boundingBox()
    expect(firstLineBox).not.toBeNull()
    await mainWindow.mouse.click(firstLineBox!.x + 12, firstLineBox!.y + firstLineBox!.height / 2)
    await expectMonacoEditorToStayAttached(mainWindow, editorSelector, 1500)

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
    await mainWindow.waitForTimeout(300)
    const scrollTopAfterClick = await testHelpers.getElementScrollTop(HOST_SELECTOR)

    expect(Math.abs(scrollTopAfterClick - scrollTopBeforeClick)).toBeLessThanOrEqual(2)
  })
})
