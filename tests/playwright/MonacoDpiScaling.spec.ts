import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, waitForMonacoEditor } from '../helpers/MonacoHelpers'

const { test, describe, expect } = createPlaywrightTestSuite({
  launchOptions: {
    args: [
      './out/main/index.js',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--headless',
      '--force-device-scale-factor=1.25'
    ]
  }
})

describe('Monaco DPI scaling', () => {
  test('keeps the editor within its matching host at 125 percent scaling', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const selector = '[data-testid="prompt-editor-dev-1"]'
    await waitForMonacoEditor(mainWindow, selector)
    await focusMonacoEditor(mainWindow, selector)
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.insertText(
      Array.from({ length: 80 }, (_, index) => `DPI scaling line ${index + 1}`).join('\n')
    )

    const result = await mainWindow.evaluate((rowSelector) => {
      const editor = document.querySelector<HTMLElement>(`${rowSelector} .monaco-editor`)
      const host = editor?.parentElement
      if (!host || !editor) return null

      const colorToRgba = (color: string): number[] => {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext('2d')
        if (!context) return []
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        return Array.from(context.getImageData(0, 0, 1, 1).data)
      }

      const hostRect = host.getBoundingClientRect()
      const editorRect = editor.getBoundingClientRect()
      return {
        devicePixelRatio,
        hostRightPx: hostRect.right,
        editorRightPx: editorRect.right,
        hostBackground: colorToRgba(getComputedStyle(host).backgroundColor),
        editorBackground: colorToRgba(getComputedStyle(editor).backgroundColor)
      }
    }, selector)

    expect(result).not.toBeNull()
    expect(result?.devicePixelRatio).toBe(1.25)
    expect(result?.editorRightPx ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      result?.hostRightPx ?? Number.NEGATIVE_INFINITY
    )
    expect(result?.hostBackground).toEqual(result?.editorBackground)
  })
})
