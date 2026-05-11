import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'
import type { Page } from '@playwright/test'

const { test, describe, expect } = createPlaywrightTestSuite()

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
})
