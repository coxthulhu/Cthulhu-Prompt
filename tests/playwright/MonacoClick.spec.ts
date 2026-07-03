import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
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
    await mainWindow.mouse.click(
      otherTitleBox.x + 12,
      otherTitleBox.y + otherTitleBox.height / 2
    )
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
